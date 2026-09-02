from fastapi import APIRouter, Query
from typing import List
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])

@router.get("", response_model=List[dict])
async def get_organizations(limit: int = Query(50, ge=1, le=1000), skip: int = Query(0, ge=0)):
    db = get_database()
    query = {}
    query.update(get_demo_filter("organizations", "organization_id"))
    cursor = db.organizations.find(query, {"_id": 0}).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)
