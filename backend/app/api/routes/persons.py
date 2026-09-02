from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter

router = APIRouter(prefix="/api/persons", tags=["Persons"])

@router.get("", response_model=List[dict])
async def get_persons(
    limit: int = Query(50, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    search: Optional[str] = None,
    role: Optional[str] = None
):
    db = get_database()
    query = {}
    query.update(get_demo_filter("persons", "person_id"))

    if role:
        query["role"] = role

    if search:
        query["$or"] = [
            {"person_id": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"occupation": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.persons.find(query, {"_id": 0}).skip(skip).limit(limit)
    persons = await cursor.to_list(length=limit)
    return persons

@router.get("/{person_id}", response_model=dict)
async def get_person_by_id(person_id: str):
    db = get_database()
    person = await db.persons.find_one({"$or": [{"person_id": person_id}, {"_id": person_id}]}, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail=f"Person '{person_id}' not found")
    return person
