import asyncio
import os
from app.db.mongodb import connect_to_mongo, get_database, close_mongo_connection

async def main():
    await connect_to_mongo()
    db = get_database()
    if db is None:
        print("Failed to connect to MongoDB")
        return

    cases_count = await db.cases.count_documents({})
    txns_count = await db.transactions.count_documents({})
    cdrs_count = await db.cdrs.count_documents({})
    events_count = await db.events.count_documents({})
    rels_count = await db.relationships.count_documents({})
    devices_count = await db.devices.count_documents({}) if "devices" in await db.list_collection_names() else 0
    vehicles_count = await db.vehicles.count_documents({}) if "vehicles" in await db.list_collection_names() else 0

    print(f"MongoDB Collections Stats:")
    print(f"  Cases: {cases_count}")
    print(f"  Transactions: {txns_count}")
    print(f"  CDRs: {cdrs_count}")
    print(f"  Events: {events_count}")
    print(f"  Relationships: {rels_count}")
    print(f"  Devices: {devices_count}")
    print(f"  Vehicles: {vehicles_count}")

    # Inspect first 3 cases
    cases = await db.cases.find({}, {"_id": 0}).limit(5).to_list(length=5)
    print("\nSample Cases:")
    for c in cases:
        print(f"  Case ID: {c.get('case_id')}, Title: {c.get('title')}, Crime Type: {c.get('crime_type') or c.get('case_type')}")

    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())
