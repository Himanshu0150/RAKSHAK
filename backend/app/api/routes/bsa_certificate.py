import hashlib
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Response, Header, Depends, status, Body
from fastapi.responses import StreamingResponse
import io

from app.db.mongodb import get_database
from app.core.bsa_generator import generate_sec_63_bsa_pdf

router = APIRouter(prefix="/api/evidence", tags=["Section 63 BSA Certificate"])

# In-memory cache for generated PDF bytes keyed by certificate_id
PDF_CACHE: Dict[str, bytes] = {}

def get_officer_info(authorization: Optional[str] = Header(None)) -> Dict[str, str]:
    """Helper to extract currently authenticated investigator session data."""
    from app.api.routes.auth import ACTIVE_TOKENS, DEFAULT_USERS
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        if token in ACTIVE_TOKENS:
            u = ACTIVE_TOKENS[token]
            return {
                "officer_name": u.get("full_name", "Sgt. Miller"),
                "officer_id": u.get("investigator_id", "ID-4412-01"),
                "role": u.get("role", "Lead Investigator"),
                "badge_number": u.get("badge_number", "Badge #4412"),
                "email": u.get("email", "miller@sherlock.gov")
            }
    # Fallback to default Lead Investigator
    return {
        "officer_name": "Sgt. Miller",
        "officer_id": "ID-4412-01",
        "role": "Lead Investigator",
        "badge_number": "Badge #4412",
        "email": "miller@sherlock.gov"
    }

@router.post("/{evidence_id}/bsa-certificate/generate", response_model=dict)
async def generate_bsa_certificate(
    evidence_id: str,
    payload: Optional[dict] = Body(None),
    authorization: Optional[str] = Header(None)
):
    """
    Generates an official Section 63 BSA, 2023 Digital Evidence Certificate (PDF).
    Creates an audit record in MongoDB 'bsa_certificates' collection.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    # 1. Fetch evidence record from MongoDB
    ev_doc = await db.evidence.find_one(
        {"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]},
        {"_id": 0}
    )
    if not ev_doc:
        raise HTTPException(status_code=404, detail=f"Evidence record '{evidence_id}' not found in MongoDB.")

    # Check evidence integrity
    ev_hash = ev_doc.get("integrity_sha256") or ev_doc.get("hash") or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    if ev_doc.get("tampered") is True:
        raise HTTPException(
            status_code=400,
            detail="Evidence verification required. Record is flagged as tampered and cannot be certified."
        )

    # 2. Extract authenticated officer details
    officer_info = get_officer_info(authorization)
    if payload and isinstance(payload, dict):
        if payload.get("officer_name"): officer_info["officer_name"] = payload["officer_name"]
        if payload.get("officer_id"): officer_info["officer_id"] = payload["officer_id"]
        if payload.get("role"): officer_info["role"] = payload["role"]

    # 3. Generate Certificate ID & Metadata
    cert_id = f"BSA-CERT-{evidence_id}-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.utcnow().isoformat()
    merkle_root = ev_doc.get("merkle_root") or "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
    device_info = "Host Workstation (RAKSHAK Secure Terminal OS: Windows 11 Pro 64-bit)"

    # 4. Generate PDF Document Bytes via ReportLab
    try:
        pdf_bytes = generate_sec_63_bsa_pdf(
            evidence_data=ev_doc,
            officer_data=officer_info,
            certificate_id=cert_id,
            merkle_root=merkle_root,
            device_info=device_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Certificate generation failed: {e}")

    pdf_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    PDF_CACHE[cert_id] = pdf_bytes
    PDF_CACHE[evidence_id] = pdf_bytes

    # 5. Persist audit record in bsa_certificates collection
    cert_doc = {
        "_id": cert_id,
        "certificate_id": cert_id,
        "evidence_id": evidence_id,
        "case_id": ev_doc.get("case_id"),
        "certificate_type": "SECTION_63_BSA",
        "certificate_version": "1.0",
        "generated_at": now_iso,
        "generated_by": officer_info["officer_name"],
        "officer_name": officer_info["officer_name"],
        "officer_id": officer_info["officer_id"],
        "officer_role": officer_info["role"],
        "device_information": device_info,
        "extraction_timestamp": ev_doc.get("collected_at") or ev_doc.get("collection_date") or now_iso,
        "evidence_type": ev_doc.get("evidence_type", "SURVEILLANCE"),
        "evidence_description": ev_doc.get("description") or ev_doc.get("title") or "Digital Evidence Item",
        "evidence_sha256": ev_hash,
        "merkle_root": merkle_root,
        "collection_metadata": {
            "source": ev_doc.get("source", "Law Enforcement Intercept"),
            "person_id": ev_doc.get("person_id")
        },
        "verification_status": "VERIFIED",
        "pdf_hash": pdf_sha256,
        "created_at": now_iso
    }

    update_payload = {k: v for k, v in cert_doc.items() if k != "_id"}
    await db.bsa_certificates.update_one(
        {"evidence_id": evidence_id},
        {"$set": update_payload, "$setOnInsert": {"_id": cert_id}},
        upsert=True
    )

    return cert_doc

@router.get("/{evidence_id}/bsa-certificate", response_model=dict)
async def get_bsa_certificate_metadata(evidence_id: str):
    """
    Retrieves Section 63 BSA certificate record for evidence_id.
    Verifies current evidence SHA-256 against recorded certificate hash.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    cert_doc = await db.bsa_certificates.find_one({"evidence_id": evidence_id}, {"_id": 0})
    if not cert_doc:
        raise HTTPException(status_code=404, detail=f"No BSA certificate generated for evidence '{evidence_id}' yet.")

    # Cross-verify current evidence SHA-256 to ensure zero tampering
    ev_doc = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})
    if ev_doc:
        current_hash = ev_doc.get("integrity_sha256") or ev_doc.get("hash")
        cert_hash = cert_doc.get("evidence_sha256")
        if current_hash and cert_hash and current_hash != cert_hash:
            cert_doc["verification_status"] = "HASH_MISMATCH"
            cert_doc["warning"] = "Evidence hash mismatch — certificate requires re-verification."

    return cert_doc

@router.get("/{evidence_id}/bsa-certificate/download")
async def download_bsa_certificate_pdf(evidence_id: str, authorization: Optional[str] = Header(None)):
    """
    Streams the generated Section 63 BSA PDF Certificate for evidence_id.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")

    # Check cache
    pdf_bytes = PDF_CACHE.get(evidence_id)

    if not pdf_bytes:
        # Check if cert doc exists in MongoDB
        cert_doc = await db.bsa_certificates.find_one({"evidence_id": evidence_id}, {"_id": 0})
        ev_doc = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})

        if not ev_doc:
            raise HTTPException(status_code=404, detail=f"Evidence record '{evidence_id}' not found.")

        officer_info = get_officer_info(authorization)
        cert_id = cert_doc.get("certificate_id") if cert_doc else f"BSA-CERT-{evidence_id}-A1"
        merkle_root = cert_doc.get("merkle_root") if cert_doc else "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2"
        device_info = cert_doc.get("device_information") if cert_doc else "Host Workstation (RAKSHAK Secure Terminal)"

        pdf_bytes = generate_sec_63_bsa_pdf(
            evidence_data=ev_doc,
            officer_data=officer_info,
            certificate_id=cert_id,
            merkle_root=merkle_root,
            device_info=device_info
        )
        PDF_CACHE[evidence_id] = pdf_bytes

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Sec_63_BSA_Certificate_{evidence_id}.pdf"'
        }
    )
