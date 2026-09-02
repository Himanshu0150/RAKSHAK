#!/usr/bin/env python3
"""
SHERLOCK — MongoDB Bulk Loader V1

Loads only SYNTHETIC operational data into MongoDB.
GROUND_TRUTH is intentionally NOT loaded.

Default source:
    E:\SIH\Data\SYNTHETIC

Default database:
    sherlock

Usage:
    python load_sherlock_mongodb.py
    python load_sherlock_mongodb.py --source E:\SIH\Data\SYNTHETIC
    python load_sherlock_mongodb.py --uri mongodb://localhost:27017 --db sherlock

Requirements:
    python -m pip install pymongo
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Any

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from pymongo.errors import BulkWriteError, CollectionInvalid
except ImportError:
    print("ERROR: pymongo is not installed.")
    print("Install with: python -m pip install pymongo")
    sys.exit(1)


DEFAULT_SOURCE = Path(r"E:\SIH\Data\SYNTHETIC")
DEFAULT_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DEFAULT_DB = os.getenv("MONGODB_DATABASE", "sherlock")

COLLECTIONS = [
    "cases",
    "persons",
    "locations",
    "phones",
    "devices",
    "organizations",
    "vehicles",
    "accounts",
    "aliases",
    "cdrs",
    "transactions",
    "events",
    "evidence",
    "relationships",
]

ID_FIELDS = {
    "cases": "case_id",
    "persons": "person_id",
    "locations": "location_id",
    "phones": "phone_id",
    "devices": "device_id",
    "organizations": "organization_id",
    "vehicles": "vehicle_id",
    "accounts": "account_id",
    "aliases": "alias_id",
    "cdrs": "cdr_id",
    "transactions": "transaction_id",
    "events": "event_id",
    "evidence": "evidence_id",
    "relationships": "relationship_id",
}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--source", default=str(DEFAULT_SOURCE))
    p.add_argument("--uri", default=DEFAULT_URI)
    p.add_argument("--db", default=DEFAULT_DB)
    p.add_argument("--batch-size", type=int, default=2000)
    p.add_argument(
        "--replace",
        action="store_true",
        help="Drop operational collections before loading.",
    )
    return p.parse_args()


def convert_value(field: str, value: str) -> Any:
    if value is None:
        return None

    # Keep identifiers, phone numbers and synthetic strings exactly as strings.
    if field.endswith("_id") or field in {
        "phone_number", "masked_identifier", "registration_alias",
        "reference", "synthetic_flag", "severity", "crime_type",
        "crime_id", "case_status", "state", "district", "police_station",
        "name", "alias", "occupation", "gender", "description",
    }:
        return value

    if field in {
        "age", "duration_seconds", "importance_score",
    }:
        try:
            return int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value

    if field in {
        "amount", "confidence", "reliability", "latitude", "longitude"
    }:
        try:
            return float(value)
        except ValueError:
            return value

    return value


def read_csv(path: Path):
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            yield {
                k: convert_value(k, v)
                for k, v in raw.items()
            }


def count_csv(path: Path) -> int:
    with path.open("r", encoding="utf-8", newline="") as f:
        return max(0, sum(1 for _ in f) - 1)


def create_indexes(db):
    """
    Indexes are designed around the planned investigator workflow:
      search -> case -> dossier -> graph -> CDR/transaction -> timeline/evidence.
    """

    index_specs = {
        "cases": [
            ([("case_id", ASCENDING)], {"unique": True, "name": "uq_case_id"}),
            ([("crime_type", ASCENDING)], {"name": "idx_case_crime"}),
            ([("crime_category", ASCENDING)], {"name": "idx_case_category"}),
            ([("state", ASCENDING), ("district", ASCENDING)], {"name": "idx_case_location"}),
            ([("incident_date", DESCENDING)], {"name": "idx_case_incident"}),
            ([("case_status", ASCENDING)], {"name": "idx_case_status"}),
        ],
        "persons": [
            ([("person_id", ASCENDING)], {"unique": True, "name": "uq_person_id"}),
            ([("name", ASCENDING)], {"name": "idx_person_name"}),
            ([("state", ASCENDING), ("district", ASCENDING)], {"name": "idx_person_location"}),
            ([("role", ASCENDING)], {"name": "idx_person_role"}),
        ],
        "locations": [
            ([("location_id", ASCENDING)], {"unique": True, "name": "uq_location_id"}),
            ([("state", ASCENDING), ("district", ASCENDING)], {"name": "idx_location_area"}),
        ],
        "phones": [
            ([("phone_id", ASCENDING)], {"unique": True, "name": "uq_phone_id"}),
            ([("phone_number", ASCENDING)], {"unique": True, "name": "uq_phone_number"}),
            ([("person_id", ASCENDING)], {"name": "idx_phone_person"}),
            ([("device_id", ASCENDING)], {"name": "idx_phone_device"}),
        ],
        "devices": [
            ([("device_id", ASCENDING)], {"unique": True, "name": "uq_device_id"}),
            ([("person_id", ASCENDING)], {"name": "idx_device_person"}),
        ],
        "organizations": [
            ([("organization_id", ASCENDING)], {"unique": True, "name": "uq_org_id"}),
            ([("name", ASCENDING)], {"name": "idx_org_name"}),
            ([("organization_type", ASCENDING)], {"name": "idx_org_type"}),
            ([("network_type", ASCENDING)], {"name": "idx_org_network"}),
        ],
        "vehicles": [
            ([("vehicle_id", ASCENDING)], {"unique": True, "name": "uq_vehicle_id"}),
            ([("registration_alias", ASCENDING)], {"unique": True, "name": "uq_vehicle_registration"}),
            ([("owner_person_id", ASCENDING)], {"name": "idx_vehicle_owner"}),
        ],
        "accounts": [
            ([("account_id", ASCENDING)], {"unique": True, "name": "uq_account_id"}),
            ([("person_id", ASCENDING)], {"name": "idx_account_person"}),
            ([("institution_type", ASCENDING)], {"name": "idx_account_institution"}),
        ],
        "aliases": [
            ([("alias_id", ASCENDING)], {"unique": True, "name": "uq_alias_id"}),
            ([("person_id", ASCENDING)], {"name": "idx_alias_person"}),
            ([("alias", ASCENDING)], {"name": "idx_alias_text"}),
        ],
        "cdrs": [
            ([("cdr_id", ASCENDING)], {"unique": True, "name": "uq_cdr_id"}),
            ([("caller_phone_id", ASCENDING), ("timestamp", DESCENDING)], {"name": "idx_cdr_caller_time"}),
            ([("receiver_phone_id", ASCENDING), ("timestamp", DESCENDING)], {"name": "idx_cdr_receiver_time"}),
            ([("timestamp", DESCENDING)], {"name": "idx_cdr_time"}),
            ([("network_id", ASCENDING)], {"name": "idx_cdr_network"}),
        ],
        "transactions": [
            ([("transaction_id", ASCENDING)], {"unique": True, "name": "uq_txn_id"}),
            ([("source_account_id", ASCENDING), ("timestamp", DESCENDING)], {"name": "idx_txn_source_time"}),
            ([("destination_account_id", ASCENDING), ("timestamp", DESCENDING)], {"name": "idx_txn_destination_time"}),
            ([("timestamp", DESCENDING)], {"name": "idx_txn_time"}),
            ([("network_id", ASCENDING)], {"name": "idx_txn_network"}),
            ([("amount", DESCENDING)], {"name": "idx_txn_amount"}),
        ],
        "events": [
            ([("event_id", ASCENDING)], {"unique": True, "name": "uq_event_id"}),
            ([("case_id", ASCENDING), ("timestamp", ASCENDING)], {"name": "idx_event_case_time"}),
            ([("person_id", ASCENDING), ("timestamp", DESCENDING)], {"name": "idx_event_person_time"}),
            ([("location_id", ASCENDING), ("timestamp", DESCENDING)], {"name": "idx_event_location_time"}),
        ],
        "evidence": [
            ([("evidence_id", ASCENDING)], {"unique": True, "name": "uq_evidence_id"}),
            ([("case_id", ASCENDING)], {"name": "idx_evidence_case"}),
            ([("related_person_id", ASCENDING)], {"name": "idx_evidence_person"}),
            ([("evidence_type", ASCENDING)], {"name": "idx_evidence_type"}),
            ([("collected_at", DESCENDING)], {"name": "idx_evidence_collected"}),
        ],
        "relationships": [
            ([("relationship_id", ASCENDING)], {"unique": True, "name": "uq_relationship_id"}),
            ([("source_entity_type", ASCENDING), ("source_entity_id", ASCENDING)], {"name": "idx_rel_source"}),
            ([("target_entity_type", ASCENDING), ("target_entity_id", ASCENDING)], {"name": "idx_rel_target"}),
            ([("relationship_type", ASCENDING)], {"name": "idx_rel_type"}),
            ([("case_id", ASCENDING)], {"name": "idx_rel_case"}),
            ([("start_time", DESCENDING)], {"name": "idx_rel_time"}),
        ],
    }

    for collection, specs in index_specs.items():
        for keys, options in specs:
            try:
                db[collection].create_index(keys, **options)
            except Exception as exc:
                print(f"WARNING: index {collection}/{options.get('name')} -> {exc}")


def validate_after_load(db, source):
    results = []
    failures = []

    # Expected row counts from CSV files.
    for collection in COLLECTIONS:
        csv_path = source / f"{collection}.csv"
        expected = count_csv(csv_path)
        actual = db[collection].count_documents({})
        ok = expected == actual
        results.append({
            "check": f"count_{collection}",
            "status": "PASS" if ok else "FAIL",
            "expected": expected,
            "actual": actual,
        })
        if not ok:
            failures.append(f"{collection}: expected {expected}, got {actual}")

    # Synthetic-only enforcement.
    for collection in COLLECTIONS:
        bad = db[collection].count_documents({"synthetic_flag": {"$ne": "true"}})
        ok = bad == 0
        results.append({
            "check": f"synthetic_only_{collection}",
            "status": "PASS" if ok else "FAIL",
            "non_synthetic_records": bad,
        })
        if not ok:
            failures.append(f"{collection}: {bad} records are not marked synthetic")

    # Critical FK checks using MongoDB aggregation.
    fk_checks = [
        ("phones.person_id", "phones", "person_id", "persons"),
        ("phones.device_id", "phones", "device_id", "devices"),
        ("accounts.person_id", "accounts", "person_id", "persons"),
        ("vehicles.owner_person_id", "vehicles", "owner_person_id", "persons"),
        ("aliases.person_id", "aliases", "person_id", "persons"),
        ("events.case_id", "events", "case_id", "cases"),
        ("events.person_id", "events", "person_id", "persons"),
        ("events.location_id", "events", "location_id", "locations"),
        ("evidence.case_id", "evidence", "case_id", "cases"),
        ("evidence.related_person_id", "evidence", "related_person_id", "persons"),
    ]

    for label, collection, field, foreign_collection in fk_checks:
        values = db[collection].distinct(field)
        foreign_values = set(db[foreign_collection].distinct(ID_FIELDS[foreign_collection]))
        missing = [v for v in values if v not in foreign_values and v != ""]
        ok = not missing
        results.append({
            "check": f"fk_{label}",
            "status": "PASS" if ok else "FAIL",
            "orphan_distinct_values": len(missing),
        })
        if not ok:
            failures.append(f"{label}: {len(missing)} orphan values")

    # Confirm ground truth collections were not loaded.
    truth_collection_names = [
        "case_truth", "entity_truth", "relationship_truth",
        "network_membership", "hidden_relationships", "case_network_map"
    ]
    existing_truth = [
        c for c in truth_collection_names
        if c in db.list_collection_names()
    ]
    ok = not existing_truth
    results.append({
        "check": "ground_truth_isolation",
        "status": "PASS" if ok else "FAIL",
        "collections_found": existing_truth,
    })
    if not ok:
        failures.append(f"Ground truth collections exist: {existing_truth}")

    report = {
        "status": "PASS" if not failures else "FAIL",
        "checked_at_utc": datetime.now(__import__("datetime").UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "checks": results,
        "failures": failures,
        "source": str(source),
        "database": db.name,
    }

    report_path = source / "MONGODB_LOAD_VALIDATION.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return report


def main():
    args = parse_args()
    source = Path(args.source)

    if not source.exists():
        print(f"ERROR: source directory not found: {source}")
        sys.exit(1)

    missing = [
        f"{name}.csv" for name in COLLECTIONS
        if not (source / f"{name}.csv").exists()
    ]
    if missing:
        print("ERROR: missing operational CSV files:")
        for item in missing:
            print("  -", item)
        sys.exit(1)

    # Explicitly refuse to use the ground-truth directory.
    truth_dir = source.parent / "GROUND_TRUTH"
    if truth_dir.exists():
        print(f"Ground truth detected at: {truth_dir}")
        print("Ground truth will NOT be loaded.")

    print("Connecting to MongoDB...")
    print("URI:", args.uri)
    print("Database:", args.db)
    print("Source:", source)

    try:
        client = MongoClient(args.uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
    except Exception as exc:
        print("\nERROR: Could not connect to MongoDB.")
        print(exc)
        print("\nStart MongoDB and retry.")
        print("For local MongoDB, the expected URI is:")
        print("mongodb://localhost:27017")
        sys.exit(2)

    db = client[args.db]

    if args.replace:
        print("\n--replace enabled: dropping operational collections...")
        for collection in COLLECTIONS:
            db[collection].drop()

    print("\nLoading collections...")
    loaded = {}

    for collection in COLLECTIONS:
        path = source / f"{collection}.csv"
        total = count_csv(path)
        print(f"  {collection:16s} {total:>8,} records", end=" ... ")

        inserted = 0
        batch = []

        try:
            for row in read_csv(path):
                batch.append(row)
                if len(batch) >= args.batch_size:
                    result = db[collection].insert_many(batch, ordered=False)
                    inserted += len(result.inserted_ids)
                    batch.clear()

            if batch:
                result = db[collection].insert_many(batch, ordered=False)
                inserted += len(result.inserted_ids)

            loaded[collection] = inserted
            print("OK")

        except BulkWriteError as exc:
            print("FAILED")
            print(json.dumps(exc.details, indent=2, default=str))
            client.close()
            sys.exit(3)

    print("\nCreating indexes...")
    create_indexes(db)
    print("Indexes created.")

    print("\nRunning post-load validation...")
    report = validate_after_load(db, source)

    print("\n=== MONGODB LOAD RESULT ===")
    print("Database:", args.db)
    print("Status:", report["status"])
    print("Collections:", len(COLLECTIONS))

    for collection, count in loaded.items():
        actual = db[collection].count_documents({})
        print(f"  {collection:16s} {actual:>8,}")

    print("\nValidation report:")
    print(source / "MONGODB_LOAD_VALIDATION.json")

    if report["failures"]:
        print("\nFAILURES:")
        for failure in report["failures"]:
            print("  -", failure)
        client.close()
        sys.exit(4)

    print("\nMongoDB operational dataset loaded successfully.")
    print("GROUND_TRUTH was NOT loaded.")
    client.close()


if __name__ == "__main__":
    main()
