from fastapi import APIRouter, Query
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_id_set, is_demo_enabled

router = APIRouter(prefix="/api/search", tags=["Global Search"])

@router.get("", response_model=dict)
async def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100)
):
    db = get_database()
    regex_pattern = {"$regex": q, "$options": "i"}

    # Build base queries with demo scoping
    case_query = {
        "$or": [
            {"case_id": regex_pattern},
            {"crime_type": regex_pattern},
            {"police_station": regex_pattern}
        ]
    }
    person_query = {
        "$or": [
            {"person_id": regex_pattern},
            {"name": regex_pattern},
            {"occupation": regex_pattern}
        ]
    }
    evidence_query = {
        "$or": [
            {"evidence_id": regex_pattern},
            {"evidence_type": regex_pattern},
            {"source": regex_pattern}
        ]
    }

    # Scope to demo subset if enabled
    if is_demo_enabled():
        case_ids = get_demo_id_set("cases")
        if case_ids:
            case_query["case_id"] = {"$in": list(case_ids)}
        person_ids = get_demo_id_set("persons")
        if person_ids:
            person_query["person_id"] = {"$in": list(person_ids)}
        evidence_ids = get_demo_id_set("evidence")
        if evidence_ids:
            evidence_query["evidence_id"] = {"$in": list(evidence_ids)}

    # Search Cases
    cases_cursor = db.cases.find(case_query, {"_id": 0}).limit(limit)
    cases = await cases_cursor.to_list(length=limit)

    # Search Persons
    persons_cursor = db.persons.find(person_query, {"_id": 0}).limit(limit)
    persons = await persons_cursor.to_list(length=limit)

    # Search Evidence
    evidence_cursor = db.evidence.find(evidence_query, {"_id": 0}).limit(limit)
    evidence = await evidence_cursor.to_list(length=limit)

    return {
        "query": q,
        "cases": cases,
        "persons": persons,
        "evidence": evidence,
        "totalMatches": len(cases) + len(persons) + len(evidence)
    }
