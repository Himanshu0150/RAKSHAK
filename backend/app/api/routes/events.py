from fastapi import APIRouter, Query
from typing import List, Optional
from app.core.context_resolver import get_scoped_events

router = APIRouter(tags=["Events & Timeline"])

@router.get("/api/events", response_model=List[dict])
@router.get("/api/timeline/events", response_model=List[dict])
async def get_timeline_events(
    limit: int = 50,
    skip: int = 0,
    case_id: Optional[str] = None,
    entity_id: Optional[str] = None
):
    limit_int = int(limit) if not isinstance(limit, int) and str(limit).isdigit() else 50
    skip_int = int(skip) if not isinstance(skip, int) and str(skip).isdigit() else 0
    cid_str = case_id if isinstance(case_id, str) else None
    eid_str = entity_id if isinstance(entity_id, str) else None

    raw_events = await get_scoped_events(case_id=cid_str, entity_id=eid_str, limit=limit_int, skip=skip_int)
    
    formatted = []
    for ev in raw_events:
        entities = []
        for f in ["person_id", "vehicle_id", "phone_id"]:
            if ev.get(f): entities.append(ev[f])
        formatted.append({
            "id": ev.get("event_id"),
            "timestamp": ev.get("timestamp", ""),
            "category": ev.get("event_type", "MOVEMENT"),
            "title": f"{ev.get('event_type', 'Event')} ({ev.get('event_id')})",
            "description": ev.get("description", ""),
            "entitiesInvolved": entities,
            "caseId": ev.get("case_id"),
            "evidenceId": ev.get("evidence_id"),
            "locationLabel": ev.get("location_id", "")
        })
    return formatted
