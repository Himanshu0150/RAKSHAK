from typing import List, Optional
from fastapi import APIRouter, Query
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter, is_demo_enabled
from app.core.context_resolver import get_scoped_anomalies

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/summary", response_model=dict)
async def get_analytics_summary(case_id: Optional[str] = None):
    db = get_database()
    cid_str = case_id if isinstance(case_id, str) and case_id.strip() else None

    if is_demo_enabled():
        cases_cnt = await db.cases.count_documents(get_demo_filter("cases", "case_id"))
        persons_cnt = await db.persons.count_documents(get_demo_filter("persons", "person_id"))
        orgs_cnt = await db.organizations.count_documents(get_demo_filter("organizations", "organization_id"))
        phones_cnt = await db.phones.count_documents(get_demo_filter("phones", "phone_id"))
        accounts_cnt = await db.accounts.count_documents(get_demo_filter("accounts", "account_id"))
        vehicles_cnt = await db.vehicles.count_documents(get_demo_filter("vehicles", "vehicle_id"))
        evidence_cnt = await db.evidence.count_documents(get_demo_filter("evidence", "evidence_id"))
        cdrs_cnt = await db.cdrs.count_documents(get_demo_filter("cdrs", "cdr_id"))
        txns_cnt = await db.transactions.count_documents(get_demo_filter("transactions", "transaction_id"))
        events_cnt = await db.events.count_documents(get_demo_filter("events", "event_id"))
        rels_cnt = await db.relationships.count_documents(get_demo_filter("relationships", "relationship_id"))

        crit_q = {"$and": [get_demo_filter("cases", "case_id"), {"$or": [{"severity": "CRITICAL"}, {"priority": "CRITICAL"}]}]}
        critical_cases = await db.cases.count_documents(crit_q)
    else:
        cases_cnt = await db.cases.count_documents({})
        persons_cnt = await db.persons.count_documents({})
        orgs_cnt = await db.organizations.count_documents({})
        phones_cnt = await db.phones.count_documents({})
        accounts_cnt = await db.accounts.count_documents({})
        vehicles_cnt = await db.vehicles.count_documents({})
        evidence_cnt = await db.evidence.count_documents({})
        cdrs_cnt = await db.cdrs.count_documents({})
        txns_cnt = await db.transactions.count_documents({})
        events_cnt = await db.events.count_documents({})
        rels_cnt = await db.relationships.count_documents({})

        critical_cases = await db.cases.count_documents({"$or": [{"severity": "CRITICAL"}, {"priority": "CRITICAL"}]})

    entities_total = persons_cnt + orgs_cnt + phones_cnt + accounts_cnt + vehicles_cnt
    total_records = cases_cnt + entities_total + evidence_cnt + cdrs_cnt + txns_cnt + events_cnt + rels_cnt

    # Dynamic anomalies count from un-scoped demo subset or case-scoped subset
    anoms = await get_scoped_anomalies(case_id=cid_str, limit=200)

    return {
        "totalRecords": total_records if not cid_str else (len(anoms) + 1),
        "activeCasesCount": cases_cnt if not cid_str else 1,
        "indexedEntitiesCount": entities_total,
        "evidenceRecordsCount": evidence_cnt,
        "cdrsCount": cdrs_cnt,
        "transactionsCount": txns_cnt,
        "relationshipsCount": rels_cnt,
        "criticalCasesCount": critical_cases,
        "anomaliesCount": len(anoms),
        "tamperSimulated": False
    }

@router.get("/anomalies", response_model=List[dict])
async def get_anomalies(
    limit: int = 200,
    case_id: Optional[str] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None
):
    cid_str = case_id if isinstance(case_id, str) else None
    cat_str = category if isinstance(category, str) else None
    sev_str = severity if isinstance(severity, str) else None
    limit_int = int(limit) if not isinstance(limit, int) and str(limit).isdigit() else 200

    return await get_scoped_anomalies(
        case_id=cid_str,
        category=cat_str,
        severity=sev_str,
        limit=limit_int
    )
