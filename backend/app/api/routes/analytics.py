import asyncio
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
        crit_q = {"$and": [get_demo_filter("cases", "case_id"), {"$or": [{"severity": "CRITICAL"}, {"priority": "CRITICAL"}]}]}
        (
            cases_cnt,
            persons_cnt,
            orgs_cnt,
            phones_cnt,
            accounts_cnt,
            vehicles_cnt,
            evidence_cnt,
            cdrs_cnt,
            txns_cnt,
            events_cnt,
            rels_cnt,
            critical_cases,
            anoms
        ) = await asyncio.gather(
            db.cases.count_documents(get_demo_filter("cases", "case_id")),
            db.persons.count_documents(get_demo_filter("persons", "person_id")),
            db.organizations.count_documents(get_demo_filter("organizations", "organization_id")),
            db.phones.count_documents(get_demo_filter("phones", "phone_id")),
            db.accounts.count_documents(get_demo_filter("accounts", "account_id")),
            db.vehicles.count_documents(get_demo_filter("vehicles", "vehicle_id")),
            db.evidence.count_documents(get_demo_filter("evidence", "evidence_id")),
            db.cdrs.count_documents(get_demo_filter("cdrs", "cdr_id")),
            db.transactions.count_documents(get_demo_filter("transactions", "transaction_id")),
            db.events.count_documents(get_demo_filter("events", "event_id")),
            db.relationships.count_documents(get_demo_filter("relationships", "relationship_id")),
            db.cases.count_documents(crit_q),
            get_scoped_anomalies(case_id=cid_str, limit=200)
        )
    else:
        crit_q = {"$or": [{"severity": "CRITICAL"}, {"priority": "CRITICAL"}]}
        (
            cases_cnt,
            persons_cnt,
            orgs_cnt,
            phones_cnt,
            accounts_cnt,
            vehicles_cnt,
            evidence_cnt,
            cdrs_cnt,
            txns_cnt,
            events_cnt,
            rels_cnt,
            critical_cases,
            anoms
        ) = await asyncio.gather(
            db.cases.count_documents({}),
            db.persons.count_documents({}),
            db.organizations.count_documents({}),
            db.phones.count_documents({}),
            db.accounts.count_documents({}),
            db.vehicles.count_documents({}),
            db.evidence.count_documents({}),
            db.cdrs.count_documents({}),
            db.transactions.count_documents({}),
            db.events.count_documents({}),
            db.relationships.count_documents({}),
            db.cases.count_documents(crit_q),
            get_scoped_anomalies(case_id=cid_str, limit=200)
        )

    entities_total = persons_cnt + orgs_cnt + phones_cnt + accounts_cnt + vehicles_cnt
    total_records = cases_cnt + entities_total + evidence_cnt + cdrs_cnt + txns_cnt + events_cnt + rels_cnt

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
