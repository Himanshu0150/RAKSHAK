#!/usr/bin/env python3
"""
SHERLOCK — PyMongo Async Bulk Data Ingestion Pipeline V2

Loads 187,767 operational records from Data/SYNTHETIC/*.csv into MongoDB Atlas/Local.
Uses pymongo.AsyncMongoClient for asynchronous bulk operations and index creation.
"""

import asyncio
import csv
import os
import sys
import time
from pathlib import Path
from pymongo import AsyncMongoClient, ASCENDING, DESCENDING

# Ensure app imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings

DATA_DIR = Path(r"E:\SIH\Data\SYNTHETIC")

COLLECTION_MAP = {
    "cases.csv": ("cases", "case_id"),
    "persons.csv": ("persons", "person_id"),
    "locations.csv": ("locations", "location_id"),
    "phones.csv": ("phones", "phone_id"),
    "devices.csv": ("devices", "device_id"),
    "organizations.csv": ("organizations", "organization_id"),
    "vehicles.csv": ("vehicles", "vehicle_id"),
    "accounts.csv": ("accounts", "account_id"),
    "aliases.csv": ("aliases", "alias_id"),
    "cdrs.csv": ("cdrs", "cdr_id"),
    "transactions.csv": ("transactions", "transaction_id"),
    "events.csv": ("events", "event_id"),
    "evidence.csv": ("evidence", "evidence_id"),
    "relationships.csv": ("relationships", "relationship_id"),
}

INDEX_RULES = {
    "cases": [("case_id", 1), ("case_number", 1), ("priority", 1), ("status", 1)],
    "persons": [("person_id", 1), ("name", 1), ("national_id", 1)],
    "locations": [("location_id", 1), ("cell_tower_id", 1)],
    "phones": [("phone_id", 1), ("phone_number", 1), ("imei", 1)],
    "devices": [("device_id", 1), ("mac_address", 1)],
    "organizations": [("organization_id", 1), ("name", 1)],
    "vehicles": [("vehicle_id", 1), ("plate_number", 1)],
    "accounts": [("account_id", 1), ("account_number", 1)],
    "aliases": [("alias_id", 1), ("person_id", 1)],
    "cdrs": [("cdr_id", 1), ("caller_phone", 1), ("receiver_phone", 1), ("timestamp", -1)],
    "transactions": [("transaction_id", 1), ("source_account", 1), ("target_account", 1), ("timestamp", -1)],
    "events": [("event_id", 1), ("case_id", 1), ("timestamp", 1)],
    "evidence": [("evidence_id", 1), ("case_id", 1), ("sha256_hash", 1)],
    "relationships": [("relationship_id", 1), ("source_id", 1), ("target_id", 1), ("relationship_type", 1)],
}

async def run_ingestion():
    print("=" * 80)
    print("SHERLOCK PYMONGO ASYNC BULK DATA INGESTION PIPELINE")
    print(f"Connecting to MongoDB URI: {settings.mongodb_uri}")
    print(f"Target Database          : {settings.mongodb_database}")
    print(f"Data Directory           : {DATA_DIR}")
    print("=" * 80)

    client = AsyncMongoClient(settings.mongodb_uri)
    db = client[settings.mongodb_database]

    total_read = 0
    total_inserted = 0
    total_skipped = 0
    start_time = time.time()

    summary_rows = []

    for csv_file, (coll_name, id_field) in COLLECTION_MAP.items():
        fpath = DATA_DIR / csv_file
        if not fpath.exists():
            print(f"[WARNING] Skipping missing file: {fpath}")
            continue

        collection = db[coll_name]
        await collection.delete_many({}) # Clean state for idempotent reload

        records = []
        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Clean whitespace & set primary _id equal to natural ID
                clean_row = {k.strip(): v.strip() for k, v in row.items() if k}
                if id_field in clean_row and clean_row[id_field]:
                    clean_row["_id"] = clean_row[id_field]
                records.append(clean_row)

        read_count = len(records)
        inserted_count = 0

        if records:
            # Batch insertion in chunks of 2,500
            batch_size = 2500
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                res = await collection.insert_many(batch, ordered=False)
                inserted_count += len(res.inserted_ids)

        # Create Indexes asynchronously
        if coll_name in INDEX_RULES:
            try:
                await collection.drop_indexes()
            except Exception:
                pass
            for idx_field, direction in INDEX_RULES[coll_name]:
                try:
                    await collection.create_index([(idx_field, direction)], background=True)
                except Exception as e:
                    print(f"    [INDEX NOTE] {coll_name}.{idx_field}: {e}")

        final_count = await collection.count_documents({})

        total_read += read_count
        total_inserted += inserted_count

        summary_rows.append((csv_file, coll_name, read_count, inserted_count, final_count))
        print(f"  [OK] {coll_name:<16}: Ingested {inserted_count:>6,d} / {read_count:>6,d} records (MongoDB count: {final_count:>6,d})", flush=True)

    await client.close()
    elapsed = time.time() - start_time

    print("=" * 80)
    print(f"{'CSV FILE':<20} | {'COLLECTION':<15} | {'READ':<8} | {'INSERTED':<10} | {'FINAL MONGO'}")
    print("-" * 80)
    for fname, cname, read_c, ins_c, final_c in summary_rows:
        print(f"{fname:<20} | {cname:<15} | {read_c:<8,d} | {ins_c:<10,d} | {final_c:<10,d}")
    print("=" * 80)
    print(f"TOTAL READ     : {total_read:>9,d}")
    print(f"TOTAL INSERTED : {total_inserted:>9,d}")
    print(f"ELAPSED TIME   : {elapsed:.2f} seconds")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_ingestion())
