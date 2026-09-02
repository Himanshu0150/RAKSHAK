from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter

router = APIRouter(prefix="/api/cases", tags=["Cases"])

@router.get("", response_model=List[dict])
async def get_cases(
    limit: int = Query(50, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None
):
    db = get_database()
    query = {}
    query.update(get_demo_filter("cases", "case_id"))

    if status and status != "ALL":
        query["status"] = status
    if priority and priority != "ALL":
        query["severity"] = priority

    if search:
        query["$or"] = [
            {"case_id": {"$regex": search, "$options": "i"}},
            {"crime_type": {"$regex": search, "$options": "i"}},
            {"investigator_id": {"$regex": search, "$options": "i"}},
            {"police_station": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.cases.find(query, {"_id": 0}).skip(skip).limit(limit)
    cases = await cursor.to_list(length=limit)
    
    # Map fields for clean frontend presentation
    for c in cases:
        c["id"] = c.get("case_id")
        c["caseNumber"] = c.get("case_id")
        c["title"] = f"{c.get('crime_type', 'Investigation')} ({c.get('case_id')})"
        c["summary"] = c.get("description") or f"Station: {c.get('police_station', 'N/A')}, District: {c.get('district', 'N/A')}"
        c["priority"] = c.get("severity", "HIGH")
        c["status"] = c.get("case_status") or c.get("status") or "UNDER_INVESTIGATION"
        c["leadInvestigator"] = c.get("investigator_id", "Lead Investigator")
        c["jurisdiction"] = f"{c.get('police_station', 'Precinct')} - {c.get('state', 'State')}"
    
    return cases

@router.get("/{case_id}", response_model=dict)
async def get_case_by_id(case_id: str):
    db = get_database()
    c = await db.cases.find_one({"$or": [{"case_id": case_id}, {"_id": case_id}]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    c["id"] = c.get("case_id")
    c["caseNumber"] = c.get("case_id")
    c["title"] = f"{c.get('crime_type', 'Investigation')} Case ({c.get('case_id')})"
    c["summary"] = f"Incident reported in {c.get('police_station', 'Precinct')}, {c.get('district', 'District')}. Severity: {c.get('severity', 'HIGH')}."
    c["priority"] = c.get("severity", "HIGH")
    c["status"] = c.get("status", "OPEN")
    c["leadInvestigator"] = c.get("investigator_id", "Lead Investigator")
    c["jurisdiction"] = f"{c.get('police_station', 'Precinct')} - {c.get('state', 'State')}"

    return c

@router.get("/{case_id}/workspace", response_model=dict)
async def get_case_workspace(case_id: str):
    db = get_database()
    case_doc = await db.cases.find_one({"$or": [{"case_id": case_id}, {"_id": case_id}]}, {"_id": 0})
    if not case_doc:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")

    # Aggregate related evidence, events, and relationships
    ev_cursor = db.evidence.find({"case_id": case_id}, {"_id": 0}).limit(100)
    evidence_list = await ev_cursor.to_list(length=100)

    events_cursor = db.events.find({"case_id": case_id}, {"_id": 0}).limit(100)
    events_list = await events_cursor.to_list(length=100)

    return {
        "case": case_doc,
        "evidence": evidence_list,
        "events": events_list,
        "totalEvidence": len(evidence_list),
        "totalEvents": len(events_list)
    }
