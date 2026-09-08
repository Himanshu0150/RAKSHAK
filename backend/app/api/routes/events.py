from fastapi import APIRouter, Query
from typing import List, Optional
from app.core.context_resolver import get_scoped_events, get_scoped_cdrs, get_scoped_transactions, get_scoped_evidence

router = APIRouter(tags=["Events & Timeline"])

@router.get("/api/events", response_model=List[dict])
@router.get("/api/timeline/events", response_model=List[dict])
async def get_timeline_events(
    limit: int = 200,
    skip: int = 0,
    case_id: Optional[str] = None,
    entity_id: Optional[str] = None
):
    limit_int = int(limit) if not isinstance(limit, int) and str(limit).isdigit() else 200
    skip_int = int(skip) if not isinstance(skip, int) and str(skip).isdigit() else 0
    cid_str = case_id if isinstance(case_id, str) else None
    eid_str = entity_id if isinstance(entity_id, str) else None

    formatted = []

    # 1. Events
    raw_events = await get_scoped_events(case_id=cid_str, entity_id=eid_str, limit=limit_int, skip=skip_int)
    for ev in raw_events:
        entities = []
        for f in ["person_id", "vehicle_id", "phone_id"]:
            if ev.get(f): entities.append(str(ev[f]))
        formatted.append({
            "id": str(ev.get("event_id")),
            "sourceType": "Events",
            "timestamp": ev.get("timestamp", ""),
            "category": (ev.get("event_type") or "MOVEMENT").upper(),
            "title": f"{ev.get('event_type', 'Event')} ({ev.get('event_id')})",
            "description": ev.get("description", ""),
            "entitiesInvolved": entities,
            "caseId": ev.get("case_id"),
            "evidenceId": ev.get("evidence_id") if str(ev.get("evidence_id")).lower() not in ("nan", "none", "null") else None,
            "locationLabel": ev.get("location_id", "")
        })

    # 2. CDRs
    raw_cdrs = await get_scoped_cdrs(case_id=cid_str, phone_id=eid_str, limit=limit_int, skip=skip_int)
    for c in raw_cdrs:
        entities = []
        for f in ["caller_phone_id", "receiver_phone_id", "caller_id", "receiver_id", "phone_id"]:
            if c.get(f): entities.append(str(c[f]))
        formatted.append({
            "id": str(c.get("cdr_id")),
            "sourceType": "CDR",
            "timestamp": c.get("timestamp") or c.get("start_time", ""),
            "category": "TELECOM",
            "title": f"CDR Call ({c.get('call_type', 'Voice')}) — {c.get('cdr_id')}",
            "description": f"Call between {c.get('caller_phone_id') or c.get('caller_phone')} and {c.get('receiver_phone_id') or c.get('receiver_phone')}. Duration: {c.get('duration_seconds', 0)}s. Tower: {c.get('location_id', 'N/A')}.",
            "entitiesInvolved": list(set(entities)),
            "caseId": c.get("case_id") or c.get("linked_case_id"),
            "evidenceId": c.get("evidence_id") if str(c.get("evidence_id")).lower() not in ("nan", "none", "null") else None,
            "locationLabel": c.get("location_id", "")
        })

    # 3. Transactions
    raw_txns = await get_scoped_transactions(case_id=cid_str, account_id=eid_str, limit=limit_int, skip=skip_int)
    for t in raw_txns:
        entities = []
        for f in ["source_account_id", "destination_account_id", "target_account_id", "account_id"]:
            if t.get(f): entities.append(str(t[f]))
        amt = float(t.get("amount", 0) or 0)
        formatted.append({
            "id": str(t.get("transaction_id")),
            "sourceType": "Transactions",
            "timestamp": t.get("timestamp", ""),
            "category": "FINANCIAL",
            "title": f"Wire Transfer ₹{amt:,.2f} ({t.get('transaction_type', 'TXN')}) — {t.get('transaction_id')}",
            "description": f"Transfer of ₹{amt:,.2f} {t.get('currency', 'INR')} from account {t.get('source_account_id', 'N/A')} to {t.get('destination_account_id') or t.get('target_account_id', 'N/A')}. Ref: {t.get('reference', 'N/A')}.",
            "entitiesInvolved": list(set(entities)),
            "caseId": t.get("case_id"),
            "evidenceId": t.get("evidence_id") if str(t.get("evidence_id")).lower() not in ("nan", "none", "null") else None,
            "locationLabel": ""
        })

    # 4. Evidence
    raw_evis = await get_scoped_evidence(case_id=cid_str, limit=limit_int, skip=skip_int)
    for e in raw_evis:
        entities = []
        for f in ["person_id", "related_person_id", "related_vehicle_id", "related_device_id"]:
            if e.get(f): entities.append(str(e[f]))
        formatted.append({
            "id": str(e.get("evidence_id")),
            "sourceType": "Evidence",
            "timestamp": e.get("collected_at") or e.get("timestamp", "2024-01-01T00:00:00"),
            "category": "SEIZURE",
            "title": f"Evidence {e.get('evidence_type', 'Record')} — {e.get('evidence_id')}",
            "description": e.get("description") or f"Seized evidence file: {e.get('file_name', 'N/A')}. Source: {e.get('source', 'Field Operations')}.",
            "entitiesInvolved": list(set(entities)),
            "caseId": e.get("case_id"),
            "evidenceId": e.get("evidence_id"),
            "locationLabel": ""
        })

    formatted.sort(key=lambda x: str(x.get("timestamp", "")), reverse=False)
    return formatted[:limit_int]
