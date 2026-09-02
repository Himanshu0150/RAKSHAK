from fastapi import APIRouter, Query
from typing import List, Optional
from app.core.context_resolver import get_scoped_cdrs

router = APIRouter(tags=["Telecom / CDR"])

@router.get("/api/cdrs", response_model=List[dict])
@router.get("/api/telecom/cdrs", response_model=List[dict])
async def get_cdrs(
    limit: int = 50,
    skip: int = 0,
    phone_id: Optional[str] = None,
    case_id: Optional[str] = None
):
    limit_int = int(limit) if not isinstance(limit, int) and str(limit).isdigit() else 50
    skip_int = int(skip) if not isinstance(skip, int) and str(skip).isdigit() else 0
    pid_str = phone_id if isinstance(phone_id, str) else None
    cid_str = case_id if isinstance(case_id, str) else None

    raw_cdrs = await get_scoped_cdrs(case_id=cid_str, phone_id=pid_str, limit=limit_int, skip=skip_int)
    
    formatted = []
    seen = set()
    for c in raw_cdrs:
        cid = c.get("cdr_id") or f"{c.get('caller_phone_id')}-{c.get('timestamp')}"
        if cid in seen:
            continue
        seen.add(cid)

        duration = int(float(c.get("duration_seconds", 0) or 0))
        formatted.append({
            "id": cid,
            "callerPhone": c.get("caller_phone_id") or c.get("caller_phone") or "Unknown",
            "callerName": c.get("caller_phone_id") or c.get("caller_phone") or "Unknown",
            "receiverPhone": c.get("receiver_phone_id") or c.get("receiver_phone") or "Unknown",
            "receiverName": c.get("receiver_phone_id") or c.get("receiver_phone") or "Unknown",
            "timestamp": c.get("timestamp", ""),
            "durationSeconds": duration,
            "callType": c.get("call_type", "VOICE"),
            "cellTowerId": c.get("cell_tower_id", "TOWER-UNKNOWN"),
            "cellTowerLocation": c.get("location_id", "Cell Tower Sector"),
            "flaggedAnomaly": duration < 20 or duration > 1000,
            "anomalyReason": "Short duration ping burst" if duration < 20 else ("Extended nocturnal call" if duration > 1000 else "")
        })
    return formatted
