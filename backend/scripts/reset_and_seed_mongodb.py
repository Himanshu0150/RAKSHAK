#!/usr/bin/env python3
"""
RAKSHAK — Controlled Database Reset & Seeding Mechanism V3

Resets MongoDB database 'sherlock' operational & feature collections,
imports all 17 CSV files from 'RAKSHAK_DATA_UPDATED (5)', creates all
indexes, ensures field alias compatibility, seeds default users,
and creates future feature collections.
"""

import asyncio
import csv
import hashlib
import os
import sys
import time
from pathlib import Path
from pymongo import AsyncMongoClient, ASCENDING, DESCENDING

# Ensure app imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.config import settings

DATA_DIR = Path(r"e:\SIH\RAKSHAK_DATA_UPDATED (5)")

# All expected RAKSHAK application collections
COLLECTIONS_TO_RESET = [
    "cases",
    "persons",
    "organizations",
    "phones",
    "accounts",
    "vehicles",
    "devices",
    "locations",
    "aliases",
    "identity_documents",
    "relationships",
    "events",
    "cdrs",
    "transactions",
    "evidence",
    "osint_sources",
    "osint_findings",
    "users",
    "investigation_stories",
    "investigation_story_items",
    "bsa_certificates",
]

CSV_COLLECTION_MAP = {
    "cases.csv": ("cases", "case_id"),
    "persons.csv": ("persons", "person_id"),
    "organizations.csv": ("organizations", "organization_id"),
    "phones.csv": ("phones", "phone_id"),
    "accounts.csv": ("accounts", "account_id"),
    "vehicles.csv": ("vehicles", "vehicle_id"),
    "devices.csv": ("devices", "device_id"),
    "locations.csv": ("locations", "location_id"),
    "aliases.csv": ("aliases", "alias_id"),
    "identity_documents.csv": ("identity_documents", "identity_id"),
    "relationships.csv": ("relationships", "relationship_id"),
    "events.csv": ("events", "event_id"),
    "cdrs.csv": ("cdrs", "cdr_id"),
    "transactions.csv": ("transactions", "transaction_id"),
    "evidence.csv": ("evidence", "evidence_id"),
    "osint_sources.csv": ("osint_sources", "source_id"),
    "osint_findings.csv": ("osint_findings", "finding_id"),
}

DEFAULT_USERS = [
    {
        "_id": "ID-4412-01",
        "investigator_id": "ID-4412-01",
        "email": "miller@sherlock.gov",
        "full_name": "Sgt. Miller",
        "badge_number": "Badge #4412",
        "role": "Lead Investigator",
        "password_hash": hashlib.sha256("sherlock2026".encode()).hexdigest(),
    },
    {
        "_id": "ID-0000-00",
        "investigator_id": "ID-0000-00",
        "email": "investigator@agency.gov",
        "full_name": "Agent Sherlock",
        "badge_number": "Badge #0000",
        "role": "Senior Field Agent",
        "password_hash": hashlib.sha256("password123".encode()).hexdigest(),
    },
]

INDEX_DEFINITIONS = {
    "cases": [
        [("case_id", ASCENDING)],
        [("case_number", ASCENDING)],
        [("status", ASCENDING)],
        [("priority", ASCENDING)],
    ],
    "persons": [
        [("person_id", ASCENDING)],
        [("name", ASCENDING)],
    ],
    "organizations": [
        [("organization_id", ASCENDING)],
        [("name", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "phones": [
        [("phone_id", ASCENDING)],
        [("phone_number", ASCENDING)],
        [("owner_person_id", ASCENDING)],
        [("person_id", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "accounts": [
        [("account_id", ASCENDING)],
        [("account_number", ASCENDING)],
        [("holder_person_id", ASCENDING)],
        [("person_id", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "vehicles": [
        [("vehicle_id", ASCENDING)],
        [("registration_number", ASCENDING)],
        [("owner_person_id", ASCENDING)],
        [("person_id", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "devices": [
        [("device_id", ASCENDING)],
        [("identifier", ASCENDING)],
        [("owner_person_id", ASCENDING)],
        [("person_id", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "locations": [
        [("location_id", ASCENDING)],
    ],
    "aliases": [
        [("alias_id", ASCENDING)],
        [("person_id", ASCENDING)],
    ],
    "identity_documents": [
        [("identity_id", ASCENDING)],
        [("person_id", ASCENDING)],
        [("document_number", ASCENDING)],
    ],
    "relationships": [
        [("relationship_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("source_entity_id", ASCENDING)],
        [("target_entity_id", ASCENDING)],
        [("case_id", ASCENDING), ("source_entity_id", ASCENDING)],
        [("case_id", ASCENDING), ("target_entity_id", ASCENDING)],
        [("relationship_type", ASCENDING)],
        [("evidence_id", ASCENDING)],
    ],
    "events": [
        [("event_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("entity_id", ASCENDING)],
        [("person_id", ASCENDING)],
        [("timestamp", ASCENDING)],
    ],
    "evidence": [
        [("evidence_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("person_id", ASCENDING)],
    ],
    "cdrs": [
        [("cdr_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("phone_id", ASCENDING)],
        [("caller_id", ASCENDING)],
        [("receiver_id", ASCENDING)],
        [("caller_phone_id", ASCENDING)],
        [("receiver_phone_id", ASCENDING)],
        [("timestamp", DESCENDING)],
    ],
    "transactions": [
        [("transaction_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("account_id", ASCENDING)],
        [("source_account_id", ASCENDING)],
        [("target_account_id", ASCENDING)],
        [("destination_account_id", ASCENDING)],
        [("timestamp", DESCENDING)],
    ],
    "osint_sources": [
        [("source_id", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "osint_findings": [
        [("finding_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("entity_id", ASCENDING)],
        [("source_id", ASCENDING)],
    ],
    "users": [
        [("investigator_id", ASCENDING)],
        [("email", ASCENDING)],
    ],
    "investigation_stories": [
        [("story_id", ASCENDING)],
        [("case_id", ASCENDING)],
    ],
    "investigation_story_items": [
        [("item_id", ASCENDING)],
        [("story_id", ASCENDING)],
    ],
    "bsa_certificates": [
        [("certificate_id", ASCENDING)],
        [("case_id", ASCENDING)],
        [("evidence_id", ASCENDING)],
    ],
}


def clean_row_data(coll_name: str, row: dict, id_field: str, idx: int = 0) -> dict:
    """Clean row fields, convert data types, and add compatibility aliases."""
    clean = {k.strip(): v.strip() for k, v in row.items() if k}
    if id_field in clean and clean[id_field]:
        if coll_name == "identity_documents":
            doc_type = clean.get("document_type", "").strip()
            clean["_id"] = f"{clean[id_field]}_{doc_type}" if doc_type else f"{clean[id_field]}_{idx}"
        else:
            clean["_id"] = clean[id_field]

    # Handle Relationships model requirements (Step 4)
    if coll_name == "relationships":
        if "timestamp" in clean:
            clean["observed_at"] = clean["timestamp"]
        if "source_entity_type" in clean:
            clean["source_type"] = clean["source_entity_type"]
        if "confidence" in clean and clean["confidence"]:
            try:
                clean["confidence"] = float(clean["confidence"])
            except ValueError:
                clean["confidence"] = 0.95
        else:
            clean["confidence"] = 0.95
        clean["is_inference"] = False
        if "event_id" not in clean:
            clean["event_id"] = None

    # Handle CDRs field aliases
    elif coll_name == "cdrs":
        if "caller_id" in clean:
            clean["caller_phone_id"] = clean["caller_id"]
            clean["caller_phone"] = clean["caller_id"]
            clean["phone_id"] = clean["caller_id"]
        if "receiver_id" in clean:
            clean["receiver_phone_id"] = clean["receiver_id"]
            clean["receiver_phone"] = clean["receiver_id"]
        if "start_time" in clean:
            clean["timestamp"] = clean["start_time"]
        if "duration_seconds" in clean and clean["duration_seconds"]:
            try:
                clean["duration_seconds"] = int(float(clean["duration_seconds"]))
            except ValueError:
                pass

    # Handle Transactions field aliases
    elif coll_name == "transactions":
        if "target_account_id" in clean:
            clean["destination_account_id"] = clean["target_account_id"]
        if "source_account_id" in clean:
            clean["account_id"] = clean["source_account_id"]
        if "amount" in clean and clean["amount"]:
            try:
                clean["amount"] = float(clean["amount"])
            except ValueError:
                pass

    # Handle Vehicles/Devices/Phones/Accounts owner_person_id -> person_id alias
    elif coll_name in ("vehicles", "devices", "phones"):
        if "owner_person_id" in clean:
            clean["person_id"] = clean["owner_person_id"]

    elif coll_name == "accounts":
        if "holder_person_id" in clean:
            clean["person_id"] = clean["holder_person_id"]

    # Handle Events entity_id alias
    elif coll_name == "events":
        # Check if description or title references person/entity or set person_id if available
        if "person_id" not in clean and "entity_id" in clean:
            clean["person_id"] = clean["entity_id"]
        elif "person_id" in clean and "entity_id" not in clean:
            clean["entity_id"] = clean["person_id"]

    # Handle Evidence field aliases
    elif coll_name == "evidence":
        if "title" in clean:
            clean["description"] = clean["title"]
        if "collection_date" in clean:
            clean["collected_at"] = clean["collection_date"]
        if "hash" in clean:
            clean["integrity_sha256"] = clean["hash"]

    # Handle OSINT findings confidence / float
    elif coll_name == "osint_findings":
        if "confidence" in clean and clean["confidence"]:
            try:
                clean["confidence"] = float(clean["confidence"])
            except ValueError:
                pass

    # Handle Locations float coords
    elif coll_name == "locations":
        for field in ("latitude", "longitude"):
            if field in clean and clean[field]:
                try:
                    clean[field] = float(clean[field])
                except ValueError:
                    pass

    return clean


async def run_reset_and_seed():
    print("=" * 80)
    print("RAKSHAK CONTROLLED DATABASE RESET AND SEEDING PIPELINE")
    print("Connecting to MongoDB Atlas...")
    print(f"Target Database           : {settings.mongodb_database}")
    print(f"Data Directory            : {DATA_DIR}")
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
        print(f"Could not connect to MongoDB Atlas: {e}")
        print("STOPPING — local MongoDB fallback is disabled.")
        raise SystemExit(1)

    # STEP 3: RESET OLD DATABASE DATA (drop application data collections)
    print("\n[STEP 3] Dropping old application data collections...")
    existing_colls = await db.list_collection_names()
    for coll in COLLECTIONS_TO_RESET:
        if coll in existing_colls:
            await db[coll].drop()
            print(f"  [DROPPED] Collection '{coll}'")

    print("\n[STEP 7] Importing RAKSHAK synthetic dataset into MongoDB...")
    start_time = time.time()
    summary_rows = []

    for csv_file, (coll_name, id_field) in CSV_COLLECTION_MAP.items():
        fpath = DATA_DIR / csv_file
        if not fpath.exists():
            print(f"  [ERROR] Source CSV file missing: {fpath}")
            sys.exit(1)

        collection = db[coll_name]
        records = []
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader, 1):
                clean_doc = clean_row_data(coll_name, row, id_field, idx)
                records.append(clean_doc)

        read_count = len(records)
        inserted_count = 0

        if records:
            batch_size = 2500
            for i in range(0, len(records), batch_size):
                batch = records[i : i + batch_size]
                res = await collection.insert_many(batch, ordered=False)
                inserted_count += len(res.inserted_ids)

        final_count = await collection.count_documents({})
        summary_rows.append((csv_file, coll_name, read_count, inserted_count, final_count))
        print(f"  [OK] {coll_name:<20}: Read {read_count:>6,d} | Inserted {inserted_count:>6,d} | Mongo count: {final_count:>6,d}")

    # Seed users collection
    print("\n[SEED] Initializing investigator users in 'users' collection...")
    users_coll = db["users"]
    res_u = await users_coll.insert_many(DEFAULT_USERS, ordered=False)
    user_count = await users_coll.count_documents({})
    summary_rows.append(("users (seed)", "users", len(DEFAULT_USERS), len(res_u.inserted_ids), user_count))
    print(f"  [OK] {'users':<20}: Inserted {len(res_u.inserted_ids)} seed investigator users.")

    # Ensure future feature collections exist (create empty collections if not present)
    future_collections = ["investigation_stories", "investigation_story_items", "bsa_certificates"]
    print("\n[STEP 3] Ensuring future feature collections exist...")
    current_colls = await db.list_collection_names()
    for fcoll in future_collections:
        if fcoll not in current_colls:
            await db.create_collection(fcoll)
            print(f"  [CREATED] Future collection '{fcoll}'")

    # STEP 6: INDEXES
    print("\n[STEP 6] Creating MongoDB indexes...")
    total_indexes = 0
    for coll_name, index_specs in INDEX_DEFINITIONS.items():
        collection = db[coll_name]
        for spec in index_specs:
            try:
                idx_name = await collection.create_index(spec, background=True)
                total_indexes += 1
            except Exception as e:
                print(f"  [INDEX WARNING] {coll_name} index {spec}: {e}")
    print(f"  [OK] Created {total_indexes} indexes across all collections.")

    elapsed = time.time() - start_time
    print("=" * 80)
    print(f"{'CSV FILE':<25} | {'COLLECTION':<22} | {'READ':<8} | {'INSERTED':<9} | {'FINAL MONGO'}")
    print("-" * 80)
    total_read = 0
    total_inserted = 0
    for fname, cname, read_c, ins_c, final_c in summary_rows:
        total_read += read_c
        total_inserted += ins_c
        print(f"{fname:<25} | {cname:<22} | {read_c:<8,d} | {ins_c:<9,d} | {final_c:<10,d}")
    print("=" * 80)
    print(f"TOTAL READ     : {total_read:>9,d}")
    print(f"TOTAL INSERTED : {total_inserted:>9,d}")
    print(f"ELAPSED TIME   : {elapsed:.2f} seconds")
    print("=" * 80)

    await client.close()

if __name__ == "__main__":
    asyncio.run(run_reset_and_seed())
