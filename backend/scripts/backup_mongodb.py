#!/usr/bin/env python3
"""
RAKSHAK — MongoDB Backup Utility
Exports existing collections from MongoDB to JSON files before destructive database reset operations.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from pymongo import AsyncMongoClient

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.config import settings

BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"

async def run_backup():
    print("=" * 80)
    print("RAKSHAK MONGO BACKUP UTILITY")
    print(f"Connecting to URI: {settings.mongodb_uri}")
    print(f"Target DB        : {settings.mongodb_database}")
    print("=" * 80)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BACKUP_DIR / f"backup_{timestamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

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

    coll_names = await db.list_collection_names()
    print(f"Found {len(coll_names)} existing collections: {coll_names}")

    for cname in coll_names:
        collection = db[cname]
        docs = await collection.find({}, {"_id": 0}).to_list(length=None)
        file_path = out_dir / f"{cname}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(docs, f, indent=2, default=str)
        print(f"  [BACKUP OK] Collection '{cname}' -> {len(docs)} documents written to {file_path.name}")

    await client.close()
    print("=" * 80)
    print(f"[SUCCESS] Backup completed. Artifacts saved in: {out_dir}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_backup())
