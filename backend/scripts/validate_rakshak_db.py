#!/usr/bin/env python3
"""
RAKSHAK — Database Referential Integrity Validation Pipeline (Step 8)

Queries MongoDB collections and calculates exact record counts,
checks for orphan relationships, invalid case_ids, and invalid entity references across all collections.
Exits with error code 1 if referential integrity errors are detected.
"""

import asyncio
import sys
from pathlib import Path
from pymongo import AsyncMongoClient

# Ensure app imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.config import settings

async def validate_database():
    print("=" * 80)
    print("RAKSHAK MONGODB DATASET REFERENTIAL INTEGRITY VALIDATION REPORT")
    print(f"Connecting to URI : {settings.mongodb_uri}")
    print(f"Database          : {settings.mongodb_database}")
    print("=" * 80)

    try:
        client = AsyncMongoClient(
            settings.mongodb_uri,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000
        )
        db = client[settings.mongodb_database]
        await client.admin.command('ping')
        print(f"Connected to MongoDB Atlas database '{settings.mongodb_database}'")
    except Exception as e:
        print(f"Could not connect to MongoDB Atlas ({e}). Trying local MongoDB...")
        client = AsyncMongoClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=3000)
        db = client[settings.mongodb_database]
        await client.admin.command('ping')
        print(f"Connected to local MongoDB database '{settings.mongodb_database}'")

    # 1. Fetch document counts across all application collections
    counts = {}
    collections = [
        "cases", "persons", "organizations", "phones", "accounts",
        "vehicles", "devices", "locations", "aliases", "identity_documents",
        "relationships", "events", "cdrs", "transactions", "evidence",
        "osint_sources", "osint_findings", "users", "investigation_stories",
        "investigation_story_items", "bsa_certificates"
    ]

    for c in collections:
        counts[c] = await db[c].count_documents({})

    print("\n--- RAKSHAK COLLECTION DOCUMENT COUNTS ---")
    for c in collections:
        print(f"  {c:<28}: {counts[c]:>8,d} documents")

    # 2. Build master ID sets for referential validation
    print("\n--- LOADING ENTITY & CASE ID SETS ---")
    case_ids = set(await db.cases.distinct("case_id"))
    person_ids = set(await db.persons.distinct("person_id"))
    org_ids = set(await db.organizations.distinct("organization_id"))
    phone_ids = set(await db.phones.distinct("phone_id"))
    account_ids = set(await db.accounts.distinct("account_id"))
    vehicle_ids = set(await db.vehicles.distinct("vehicle_id"))
    device_ids = set(await db.devices.distinct("device_id"))
    location_ids = set(await db.locations.distinct("location_id"))
    alias_ids = set(await db.aliases.distinct("alias_id"))
    identity_ids = set(await db.identity_documents.distinct("identity_id"))
    event_ids = set(await db.events.distinct("event_id"))
    evidence_ids = set(await db.evidence.distinct("evidence_id"))

    all_entity_ids = (
        person_ids | org_ids | phone_ids | account_ids |
        vehicle_ids | device_ids | location_ids | alias_ids |
        identity_ids | event_ids | evidence_ids | case_ids
    )

    print(f"  Cases Loaded              : {len(case_ids):>8,d}")
    print(f"  Entities Loaded           : {len(all_entity_ids):>8,d}")

    # 3. Check invalid case references across case-scoped collections
    print("\n--- CHECKING CASE REFERENTIAL INTEGRITY ---")
    invalid_case_refs = 0
    case_scoped_collections = [
        "organizations", "phones", "accounts", "vehicles", "devices",
        "relationships", "events", "cdrs", "transactions", "evidence",
        "osint_sources", "osint_findings", "investigation_stories", "bsa_certificates"
    ]

    for coll_name in case_scoped_collections:
        cursor = db[coll_name].find({"case_id": {"$exists": True, "$ne": None, "$ne": ""}}, {"case_id": 1})
        coll_invalid = 0
        async for doc in cursor:
            cid = doc.get("case_id")
            if cid and str(cid).strip() not in case_ids:
                coll_invalid += 1
        if coll_invalid > 0:
            print(f"  [INVALID CASE REFS] Collection '{coll_name}': {coll_invalid} invalid case_id references!")
        invalid_case_refs += coll_invalid

    if invalid_case_refs == 0:
        print("  [OK] Zero invalid case_id references found across all collections.")

    # 4. Check orphan relationships and invalid entity references in relationships
    print("\n--- CHECKING RELATIONSHIP REFERENTIAL INTEGRITY ---")
    orphan_relationships = 0
    invalid_entity_refs = 0

    rel_cursor = db.relationships.find({}, {"source_entity_id": 1, "target_entity_id": 1, "relationship_id": 1})
    async for rel in rel_cursor:
        src = rel.get("source_entity_id")
        tgt = rel.get("target_entity_id")
        
        src_valid = bool(src and str(src).strip() in all_entity_ids)
        tgt_valid = bool(tgt and str(tgt).strip() in all_entity_ids)

        if not src_valid or not tgt_valid:
            orphan_relationships += 1
            if not src_valid:
                invalid_entity_refs += 1
            if not tgt_valid:
                invalid_entity_refs += 1

    print(f"  Orphan Relationships Count      : {orphan_relationships}")
    print(f"  Invalid Entity References Count : {invalid_entity_refs}")

    # 5. Output Summary Report Table as requested in Step 8
    print("\n" + "=" * 80)
    print("RAKSHAK VALIDATION FINAL SUMMARY REPORT")
    print("=" * 80)
    print(f"  cases                       : {counts['cases']:>8,d}")
    print(f"  persons                     : {counts['persons']:>8,d}")
    print(f"  organizations               : {counts['organizations']:>8,d}")
    print(f"  phones                      : {counts['phones']:>8,d}")
    print(f"  accounts                    : {counts['accounts']:>8,d}")
    print(f"  vehicles                    : {counts['vehicles']:>8,d}")
    print(f"  devices                     : {counts['devices']:>8,d}")
    print(f"  locations                   : {counts['locations']:>8,d}")
    print(f"  relationships               : {counts['relationships']:>8,d}")
    print(f"  events                      : {counts['events']:>8,d}")
    print(f"  cdrs                        : {counts['cdrs']:>8,d}")
    print(f"  transactions                : {counts['transactions']:>8,d}")
    print(f"  evidence                    : {counts['evidence']:>8,d}")
    print(f"  osint_sources               : {counts['osint_sources']:>8,d}")
    print(f"  osint_findings              : {counts['osint_findings']:>8,d}")
    print(f"  orphan_relationships        : {orphan_relationships:>8,d}")
    print(f"  invalid_case_references     : {invalid_case_refs:>8,d}")
    print(f"  invalid_entity_references   : {invalid_entity_refs:>8,d}")
    print("=" * 80)

    await client.close()

    if orphan_relationships > 0 or invalid_case_refs > 0 or invalid_entity_refs > 0:
        print("\n[VALIDATION FAILED] Referential integrity errors were detected!")
        sys.exit(1)
    else:
        print("\n[VALIDATION PASSED] All referential integrity checks passed successfully with 0 errors!")

if __name__ == "__main__":
    asyncio.run(validate_database())
