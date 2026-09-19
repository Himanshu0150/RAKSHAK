import hashlib
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Body, status
from app.db.mongodb import get_database
from app.api.routes.cases import verify_case_authorization, get_current_user_from_header_async
from app.core.blockchain_service import blockchain_service

router = APIRouter(prefix="/api/evidence", tags=["Blockchain Integrity"])


@router.post("/{evidence_id}/blockchain-anchor", response_model=dict)
async def anchor_evidence_blockchain(
    evidence_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Anchors evidence SHA-256 hash onto the EVM blockchain.
    Stores evidence_id, evidence_hash, case_id, timestamp, and txHash on-chain.
    Updates MongoDB record with blockchain metadata.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable")

    ev = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    case_id = ev.get("case_id") or ev.get("caseId")
    if case_id:
        await verify_case_authorization(case_id, authorization)

    user = await get_current_user_from_header_async(authorization)
    investigator = user.get("full_name") or user.get("investigator_id") or "Lead Investigator"

    if not blockchain_service.is_available():
        return {
            "evidence_id": evidence_id,
            "blockchain_status": "Blockchain service unavailable",
            "message": "Blockchain service unavailable. Verify network connection or BLOCKCHAIN_RPC_URL configuration."
        }

    sha256_hash = ev.get("integrity_sha256") or ev.get("hash") or ev.get("sha256Hash")
    if not sha256_hash:
        desc = ev.get("description") or ev.get("title") or ""
        sha256_hash = hashlib.sha256(f"{case_id}:{desc}:{ev.get('evidence_type', '')}".encode()).hexdigest()

    try:
        anchor_record = blockchain_service.register_evidence(
            evidence_id=evidence_id,
            evidence_hash=sha256_hash,
            case_id=case_id or "GENERAL",
            investigator_id=investigator
        )
    except ValueError as ve:
        # Evidence already registered on blockchain (immutability rule)
        anchor_record = blockchain_service.get_evidence_anchor(evidence_id)
        if not anchor_record:
            raise HTTPException(status_code=400, detail=str(ve))

    # Update MongoDB metadata
    update_data = {
        "blockchain_status": "Anchored",
        "blockchain_tx_hash": anchor_record["transaction_hash"],
        "blockchain_network": anchor_record["network"],
        "blockchain_timestamp": anchor_record["timestamp"],
        "anchored_hash": anchor_record["evidence_hash"]
    }

    # Add custody log entry
    custody_log_entry = {
        "id": f"LOG-BC-{anchor_record['transaction_hash'][:8].upper()}",
        "timestamp": anchor_record["timestamp"],
        "action": "BLOCKCHAIN_ANCHORED",
        "officer": investigator,
        "hash": sha256_hash,
        "status": "VERIFIED",
        "notes": f"Anchored to {anchor_record['network']}. TxHash: {anchor_record['transaction_hash'][:18]}..."
    }

    await db.evidence.update_one(
        {"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]},
        {
            "$set": update_data,
            "$push": {"custody_chain": custody_log_entry}
        }
    )

    ev.update(update_data)
    ev["evidence_id"] = evidence_id
    ev["id"] = evidence_id
    return {
        "evidence_id": evidence_id,
        "blockchain_status": "Anchored",
        "blockchain_tx_hash": anchor_record["transaction_hash"],
        "blockchain_network": anchor_record["network"],
        "blockchain_timestamp": anchor_record["timestamp"],
        "anchored_hash": anchor_record["evidence_hash"],
        "message": f"Successfully anchored SHA-256 hash to {anchor_record['network']}."
    }


@router.get("/{evidence_id}/blockchain-status", response_model=dict)
async def get_evidence_blockchain_status(
    evidence_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Retrieves blockchain anchoring status and on-chain metadata for evidence.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable")

    ev = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    case_id = ev.get("case_id") or ev.get("caseId")
    if case_id:
        await verify_case_authorization(case_id, authorization)

    if not blockchain_service.is_available():
        return {
            "evidence_id": evidence_id,
            "blockchain_status": "Blockchain service unavailable",
            "available": False
        }

    anchor = blockchain_service.get_evidence_anchor(evidence_id)
    if not anchor:
        return {
            "evidence_id": evidence_id,
            "blockchain_status": ev.get("blockchain_status") or "Not Anchored",
            "available": True,
            "anchored": False
        }

    return {
        "evidence_id": evidence_id,
        "blockchain_status": ev.get("blockchain_status") or "Anchored",
        "available": True,
        "anchored": True,
        "blockchain_tx_hash": anchor["transaction_hash"],
        "blockchain_network": anchor["network"],
        "blockchain_timestamp": anchor["timestamp"],
        "anchored_hash": anchor["evidence_hash"],
        "block_number": anchor.get("block_number")
    }


@router.post("/{evidence_id}/verify-blockchain", response_model=dict)
async def verify_evidence_blockchain(
    evidence_id: str,
    payload: Optional[Dict[str, Any]] = Body(None),
    authorization: Optional[str] = Header(None)
):
    """
    Verifies evidence SHA-256 hash against the immutable blockchain anchor record.
    Calculates current hash and compares it with on-chain anchored hash.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable")

    ev = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")

    case_id = ev.get("case_id") or ev.get("caseId")
    if case_id:
        await verify_case_authorization(case_id, authorization)

    if not blockchain_service.is_available():
        return {
            "verified": False,
            "status": "Blockchain service unavailable",
            "message": "Blockchain service unavailable"
        }

    # Determine current SHA-256 hash (from payload if provided, or from evidence record)
    current_hash = None
    if payload and isinstance(payload, dict) and payload.get("current_hash"):
        current_hash = payload.get("current_hash")
    elif payload and isinstance(payload, dict) and payload.get("tampered") is True:
        # Simulate corrupted/tampered hash
        orig_hash = ev.get("integrity_sha256") or ev.get("hash") or ev.get("sha256Hash") or ""
        current_hash = hashlib.sha256(f"CORRUPTED_PAYLOAD_{orig_hash}".encode()).hexdigest()
    else:
        current_hash = ev.get("integrity_sha256") or ev.get("hash") or ev.get("sha256Hash")

    if not current_hash:
        desc = ev.get("description") or ev.get("title") or ""
        current_hash = hashlib.sha256(f"{case_id}:{desc}:{ev.get('evidence_type', '')}".encode()).hexdigest()

    is_verified, anchor_record, status_str = blockchain_service.verify_evidence(evidence_id, current_hash)

    if status_str == "Not Anchored":
        return {
            "verified": False,
            "status": "Not Anchored",
            "evidence_id": evidence_id,
            "current_hash": current_hash,
            "anchored_hash": None,
            "message": "Evidence is not anchored on the blockchain ledger."
        }

    if is_verified:
        msg_header = "✓ Evidence Integrity Verified"
        msg_detail = "Hash matches blockchain record."
        updated_status = "Verified"
    else:
        msg_header = "✕ Evidence Integrity Check Failed"
        msg_detail = "Current evidence hash does not match the blockchain record."
        updated_status = "Integrity Mismatch"

    # Update status in MongoDB
    await db.evidence.update_one(
        {"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]},
        {"$set": {"blockchain_status": updated_status}}
    )

    return {
        "verified": is_verified,
        "status": updated_status,
        "evidence_id": evidence_id,
        "current_hash": current_hash,
        "anchored_hash": anchor_record["evidence_hash"] if anchor_record else None,
        "blockchain_network": anchor_record["network"] if anchor_record else None,
        "blockchain_tx_hash": anchor_record["transaction_hash"] if anchor_record else None,
        "blockchain_timestamp": anchor_record["timestamp"] if anchor_record else None,
        "header": msg_header,
        "message": msg_detail
    }
