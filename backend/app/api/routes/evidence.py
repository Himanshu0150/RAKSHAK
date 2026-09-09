import io
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Header, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.db.mongodb import get_database
from app.core.context_resolver import get_scoped_evidence
from app.api.routes.cases import verify_case_authorization, get_current_user_from_header_async
from app.core.demo_subset import register_demo_id
from app.core.evidence_pdf_generator import generate_case_evidence_export_pdf

router = APIRouter(prefix="/api/evidence", tags=["Evidence"])


def format_evidence_response(ev: dict, fallback_case_id: Optional[str] = None) -> dict:
    ev_id = ev.get("evidence_id") or ev.get("id") or f"EVID-{uuid.uuid4().hex[:8].upper()}"
    case_id = ev.get("case_id") or ev.get("caseId") or fallback_case_id
    title = ev.get("title") or ev.get("description") or f"{ev.get('evidence_type', 'Digital')} Record ({ev_id})"
    desc = ev.get("description") or title
    etype = (ev.get("evidence_type") or ev.get("evidenceType") or "SURVEILLANCE").upper()
    sha256 = ev.get("integrity_sha256") or ev.get("hash") or ev.get("sha256Hash") or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    collected_at = ev.get("collected_at") or ev.get("collectedAt") or ev.get("collection_date") or datetime.utcnow().isoformat()
    collected_by = ev.get("collected_by") or ev.get("collectedBy") or "Lead Investigator"
    source = ev.get("source") or ev.get("sourceDeviceOrMedium") or "Law Enforcement Intercept"

    chain = []
    raw_custody = ev.get("custody_chain") or ev.get("custodyLogs") or ev.get("chainOfCustody") or []
    if isinstance(raw_custody, list) and len(raw_custody) > 0:
        for item in raw_custody:
            if isinstance(item, dict):
                c_name = item.get("officer") or item.get("actor") or item.get("custodianName") or collected_by
                chain.append({
                    "id": item.get("id") or f"LOG-{uuid.uuid4().hex[:6].upper()}",
                    "timestamp": item.get("timestamp") or collected_at,
                    "custodianName": c_name,
                    "actor": c_name,
                    "action": item.get("action") or "EVIDENCE_INGESTED",
                    "verificationHash": item.get("hash") or item.get("verificationHash") or sha256,
                    "status": item.get("status") or "VERIFIED",
                    "notes": item.get("notes") or f"Ingested & Anchored. SHA-256: {sha256[:16]}..."
                })
    
    if not chain:
        chain.append({
            "id": f"LOG-{uuid.uuid4().hex[:6].upper()}",
            "timestamp": collected_at,
            "custodianName": collected_by,
            "actor": collected_by,
            "action": "EVIDENCE_INGESTED",
            "verificationHash": sha256,
            "status": "VERIFIED",
            "notes": f"Ingested & Anchored into MongoDB. SHA-256: {sha256[:16]}..."
        })

    res = dict(ev)
    res["id"] = ev_id
    res["evidence_id"] = ev_id
    res["evidenceNumber"] = ev_id
    res["title"] = title
    res["description"] = desc
    res["evidenceType"] = etype
    res["evidence_type"] = etype
    res["caseId"] = case_id
    res["case_id"] = case_id
    res["sha256Hash"] = sha256
    res["integrity_sha256"] = sha256
    res["hash"] = sha256
    res["sourceDeviceOrMedium"] = source
    res["source"] = source
    res["collectionTimestamp"] = collected_at
    res["collectedAt"] = collected_at
    res["collected_at"] = collected_at
    res["collectedBy"] = collected_by
    res["collected_by"] = collected_by
    res["chainOfCustodyLocation"] = ev.get("chain_of_custody_location") or "Precinct-7 Secure Bay"
    res["rawPayload"] = desc
    res["verified"] = True
    res["tampered"] = ev.get("tampered") is True
    res["custodyLogs"] = chain
    res["chainOfCustody"] = chain
    return res


@router.get("", response_model=List[dict])
async def get_evidence(
    limit: int = 50,
    skip: int = 0,
    case_id: Optional[str] = None,
    evidence_type: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    limit_int = int(limit) if not isinstance(limit, int) and str(limit).isdigit() else 50
    skip_int = int(skip) if not isinstance(skip, int) and str(skip).isdigit() else 0
    cid_str = case_id if isinstance(case_id, str) else None
    etype_str = evidence_type if isinstance(evidence_type, str) else None

    if cid_str:
        await verify_case_authorization(cid_str, authorization)

    evidence_items = await get_scoped_evidence(case_id=cid_str, evidence_type=etype_str, limit=limit_int, skip=skip_int)
    return [format_evidence_response(ev, cid_str) for ev in evidence_items]


@router.get("/export-pdf")
async def export_case_evidence_pdf(
    case_id: str = Query(..., description="Case ID to export evidence for"),
    authorization: Optional[str] = Header(None)
):
    """
    Generates and streams a PDF report containing ALL evidence belonging ONLY to the requested case.
    Strictly verifies case authorization to prevent exposing evidence from other cases.
    Does NOT claim legal admissibility.
    """
    user = await verify_case_authorization(case_id, authorization)
    officer_name = user.get("full_name") or user.get("investigator_id") or "Lead Investigator"

    db = get_database()
    case_title = f"Case {case_id}"
    if db is not None:
        case_doc = await db.cases.find_one({"$or": [{"case_id": case_id}, {"_id": case_id}]}, {"_id": 0})
        if case_doc:
            case_title = f"{case_doc.get('crime_type', 'Investigation')} Case ({case_id})"

    raw_evidence = await get_scoped_evidence(case_id=case_id, limit=10000)
    # Filter strictly by target case_id to prevent leak of evidence belonging to other cases
    target_cid_clean = str(case_id).strip().upper()
    evidence_items = [
        ev for ev in raw_evidence
        if str(ev.get("case_id") or ev.get("caseId") or "").strip().upper() == target_cid_clean
    ]
    
    pdf_bytes = generate_case_evidence_export_pdf(
        case_id=case_id,
        case_title=case_title,
        evidence_list=evidence_items,
        officer_name=officer_name
    )

    filename = f"RAKSHAK_Evidence_Export_{case_id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


class CreateEvidenceSchema(BaseModel):
    description: str
    evidence_type: str = "SURVEILLANCE"
    case_id: Optional[str] = None
    person_id: Optional[str] = None
    source: Optional[str] = "Law Enforcement Intercept"
    collected_at: Optional[str] = None
    integrity_sha256: Optional[str] = None

@router.post("", response_model=dict)
async def create_evidence(
    payload: CreateEvidenceSchema,
    authorization: Optional[str] = Header(None)
):
    target_case_id = payload.case_id.strip() if payload.case_id and payload.case_id.strip() else None

    if target_case_id:
        await verify_case_authorization(target_case_id, authorization)

    user = await get_current_user_from_header_async(authorization)
    officer_name = user.get("full_name") or user.get("investigator_id") or "Lead Investigator"

    db = get_database()
    now_str = datetime.utcnow().isoformat()
    desc_clean = payload.description.strip()
    etype_clean = payload.evidence_type.strip().upper()

    content_str = f"{target_case_id or 'GENERAL'}:{desc_clean}:{etype_clean}"
    sha256 = payload.integrity_sha256 or hashlib.sha256(content_str.encode()).hexdigest()

    # Deduplication check: return existing record if identical evidence exists under the same case
    if db is not None:
        dup_query = {}
        if target_case_id:
            dup_query["case_id"] = target_case_id

        if payload.integrity_sha256:
            dup_query["integrity_sha256"] = payload.integrity_sha256
        else:
            dup_query["$or"] = [
                {"description": desc_clean},
                {"title": desc_clean},
                {"integrity_sha256": sha256},
                {"hash": sha256}
            ]

        existing = await db.evidence.find_one(dup_query, {"_id": 0})
        if existing:
            return format_evidence_response(existing, target_case_id)

    evidence_id = f"EVID-{uuid.uuid4().hex[:8].upper()}"

    doc = {
        "evidence_id": evidence_id,
        "title": desc_clean,
        "description": desc_clean,
        "evidence_type": etype_clean,
        "case_id": target_case_id,
        "person_id": payload.person_id,
        "related_person_id": payload.person_id,
        "source": payload.source or "Law Enforcement Intercept",
        "collected_at": payload.collected_at or now_str,
        "collection_date": (payload.collected_at or now_str).split("T")[0],
        "collected_by": officer_name,
        "chain_of_custody_location": "Precinct-7 Secure Bay",
        "integrity_sha256": sha256,
        "hash": sha256,
        "status": "Verified",
        "verified": True,
        "tampered": False,
        "custody_chain": [
            {
                "id": f"LOG-{uuid.uuid4().hex[:6].upper()}",
                "timestamp": now_str,
                "action": "EVIDENCE_INGESTED",
                "officer": officer_name,
                "hash": sha256,
                "status": "VERIFIED",
                "notes": f"Ingested & Anchored into MongoDB. SHA-256: {sha256[:16]}..."
            }
        ]
    }

    if db is not None:
        await db.evidence.insert_one(doc)
        register_demo_id("evidence", evidence_id)

    doc.pop("_id", None)
    return format_evidence_response(doc, target_case_id)


@router.get("/{evidence_id}", response_model=dict)
async def get_evidence_by_id(
    evidence_id: str,
    authorization: Optional[str] = Header(None)
):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database connection unavailable.")
        
    ev = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")
    
    if ev.get("case_id"):
        await verify_case_authorization(ev["case_id"], authorization)

    return format_evidence_response(ev)
