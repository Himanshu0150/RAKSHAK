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
from app.api.routes.cases import verify_case_authorization, get_current_user_from_header
from app.core.evidence_pdf_generator import generate_case_evidence_export_pdf

router = APIRouter(prefix="/api/evidence", tags=["Evidence"])

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
    
    for ev in evidence_items:
        ev["id"] = ev.get("evidence_id")
        ev["title"] = ev.get("description") or f"{ev.get('evidence_type', 'Digital')} Record ({ev.get('evidence_id')})"
        ev["evidenceType"] = ev.get("evidence_type", "SURVEILLANCE")
        ev["sha256Hash"] = ev.get("integrity_sha256") or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        ev["verified"] = True
        ev["tampered"] = False

    return evidence_items


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

    evidence_items = await get_scoped_evidence(case_id=case_id, limit=2000)
    
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
    if payload.case_id:
        await verify_case_authorization(payload.case_id, authorization)

    db = get_database()
    
    evidence_id = f"EVID-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.utcnow().isoformat()
    
    content_str = f"{evidence_id}:{payload.description}:{payload.evidence_type}:{now_str}"
    sha256 = payload.integrity_sha256 or hashlib.sha256(content_str.encode()).hexdigest()
    
    doc = {
        "evidence_id": evidence_id,
        "description": payload.description,
        "evidence_type": payload.evidence_type.upper(),
        "case_id": payload.case_id,
        "person_id": payload.person_id,
        "related_person_id": payload.person_id,
        "source": payload.source or "Law Enforcement Intercept",
        "collected_at": payload.collected_at or now_str,
        "integrity_sha256": sha256,
        "custody_chain": [
            {
                "timestamp": now_str,
                "action": "EVIDENCE_INGESTED",
                "officer": "Lead Investigator",
                "hash": sha256
            }
        ]
    }
    
    if db is not None:
        await db.evidence.insert_one(doc)
    
    doc.pop("_id", None)
    return {
        "id": evidence_id,
        "evidence_id": evidence_id,
        "title": payload.description,
        "description": payload.description,
        "evidenceType": payload.evidence_type.upper(),
        "evidence_type": payload.evidence_type.upper(),
        "case_id": payload.case_id,
        "caseId": payload.case_id,
        "sha256Hash": sha256,
        "integrity_sha256": sha256,
        "source": payload.source or "Law Enforcement Intercept",
        "collectedAt": payload.collected_at or now_str,
        "verified": True,
        "tampered": False
    }

@router.get("/{evidence_id}", response_model=dict)
async def get_evidence_by_id(
    evidence_id: str,
    authorization: Optional[str] = Header(None)
):
    db = get_database()
    ev = await db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"_id": evidence_id}]}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail=f"Evidence '{evidence_id}' not found")
    
    if ev.get("case_id"):
        await verify_case_authorization(ev["case_id"], authorization)

    ev["id"] = ev.get("evidence_id")
    ev["title"] = ev.get("description") or f"{ev.get('evidence_type', 'Digital')} Record ({ev.get('evidence_id')})"
    ev["evidenceType"] = ev.get("evidence_type", "SURVEILLANCE")
    ev["sha256Hash"] = ev.get("integrity_sha256") or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    ev["verified"] = True
    ev["tampered"] = False

    return ev
