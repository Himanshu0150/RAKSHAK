import asyncio
import sys
import os

# Add backend directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.mongodb import connect_to_mongo, get_database, close_mongo_connection
from app.core.demo_subset import initialize_demo_subset, get_demo_id_set, is_demo_enabled
from app.core.context_resolver import (
    resolve_context,
    get_scoped_cdrs,
    get_scoped_transactions,
    get_scoped_events,
    get_scoped_evidence,
    get_scoped_anomalies,
    get_scoped_relationships
)

async def test_case_report(case_id: str):
    print(f"\n=======================================================")
    print(f" REPORT FOR CASE: '{case_id}'")
    print(f"=======================================================")
    
    ctx = await resolve_context(case_id=case_id)
    cdrs = await get_scoped_cdrs(case_id=case_id, limit=200)
    txns = await get_scoped_transactions(case_id=case_id, limit=200)
    events = await get_scoped_events(case_id=case_id, limit=200)
    evidence = await get_scoped_evidence(case_id=case_id, limit=200)
    anom = await get_scoped_anomalies(case_id=case_id, limit=200)
    rels = await get_scoped_relationships(case_id=case_id, limit=200)

    report = {
        "case_id": case_id,
        "cases": len(ctx.case_ids),
        "persons": len(ctx.person_ids),
        "phones": len(ctx.phone_ids),
        "accounts": len(ctx.account_ids),
        "vehicles": len(ctx.vehicle_ids),
        "cdrs": len(cdrs),
        "transactions": len(txns),
        "events": len(events),
        "evidence": len(evidence),
        "relationships": len(rels),
        "anomalies": len(anom)
    }

    print(f"  - Cases        : {report['cases']}")
    print(f"  - Persons      : {report['persons']}")
    print(f"  - Phones       : {report['phones']}")
    print(f"  - Accounts     : {report['accounts']}")
    print(f"  - Vehicles     : {report['vehicles']}")
    print(f"  - CDRs         : {report['cdrs']}")
    print(f"  - Transactions : {report['transactions']}")
    print(f"  - Events       : {report['events']}")
    print(f"  - Evidence     : {report['evidence']}")
    print(f"  - Relationships: {report['relationships']}")
    print(f"  - Anomalies    : {report['anomalies']}")

    # Verify all persons are inside demo subset
    demo_persons = get_demo_id_set("persons")
    non_demo_persons = ctx.person_ids - demo_persons
    print(f"  - Non-demo persons in context: {len(non_demo_persons)} (Expected: 0)")
    assert len(non_demo_persons) == 0, f"FAILED: ContextResolver expanded outside demo persons!"

    return report, cdrs, txns

async def run_verification():
    print("[VERIFICATION] Connecting to MongoDB and initializing demo subset...")
    await connect_to_mongo()
    await initialize_demo_subset()

    test_cases = ["CASE-000001", "CASE-000002", "CASE-000029"]

    reports = {}
    cdr_sets = {}
    txn_sets = {}

    for cid in test_cases:
        rep, cdrs, txns = await test_case_report(cid)
        reports[cid] = rep
        cdr_sets[cid] = set(c.get("cdr_id") or c.get("id") for c in cdrs if c.get("cdr_id") or c.get("id"))
        txn_sets[cid] = set(t.get("transaction_id") or t.get("id") for t in txns if t.get("transaction_id") or t.get("id"))

    print(f"\n=======================================================")
    print(f" COMPARISON BETWEEN CASES")
    print(f"=======================================================")
    for i in range(len(test_cases)):
        for j in range(i + 1, len(test_cases)):
            c1 = test_cases[i]
            c2 = test_cases[j]
            shared_cdrs = cdr_sets[c1].intersection(cdr_sets[c2])
            shared_txns = txn_sets[c1].intersection(txn_sets[c2])
            print(f"Shared CDRs between {c1} & {c2}: {len(shared_cdrs)}")
            print(f"Shared Txns between {c1} & {c2}: {len(shared_txns)}")

    print(f"\n=======================================================")
    print(f" TESTING UN-SCOPED (NO CASE SELECTED) DEMO DATA FETCH")
    print(f"=======================================================")
    unscoped_cdrs = await get_scoped_cdrs(case_id=None, limit=50)
    unscoped_txns = await get_scoped_transactions(case_id=None, limit=50)
    unscoped_events = await get_scoped_events(case_id=None, limit=50)
    unscoped_evidence = await get_scoped_evidence(case_id=None, limit=50)
    
    print(f"Un-scoped CDRs count        : {len(unscoped_cdrs)} (Expected: > 0 demo records)")
    print(f"Un-scoped Transactions count: {len(unscoped_txns)} (Expected: > 0 demo records)")
    print(f"Un-scoped Events count      : {len(unscoped_events)} (Expected: > 0 demo records)")
    print(f"Un-scoped Evidence count    : {len(unscoped_evidence)} (Expected: > 0 demo records)")

    assert len(unscoped_cdrs) > 0, "FAILED: Un-scoped CDRs returned 0!"
    assert len(unscoped_txns) > 0, "FAILED: Un-scoped Transactions returned 0!"

    print(f"\n=======================================================")
    print(f" TESTING NON-EXISTENT CASE (ZERO BORROWING)")
    print(f"=======================================================")
    fake_case = "CASE-NONEXISTENT-999"
    empty_cdrs = await get_scoped_cdrs(case_id=fake_case)
    empty_txns = await get_scoped_transactions(case_id=fake_case)

    print(f"Fake Case CDR count: {len(empty_cdrs)} (Expected: 0)")
    print(f"Fake Case Txn count: {len(empty_txns)} (Expected: 0)")

    assert len(empty_cdrs) == 0, f"FAILED: Borrowed CDR records for empty case!"
    assert len(empty_txns) == 0, f"FAILED: Borrowed Transaction records for empty case!"

    print("\n[VERIFICATION SUCCESS] All demo scope constraints, case reports, and zero-borrowing safeguards verified!")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_verification())
