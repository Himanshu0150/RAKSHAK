import asyncio
import sys
import os

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.mongodb import connect_to_mongo, get_database

async def check_cases():
    await connect_to_mongo()
    db = get_database()
    cases = await db.cases.find({}, {"_id": 0}).to_list(100)
    print("Cases count:", len(cases))
    for c in cases:
        cid = c.get("case_id") or c.get("id")
        rel_count = await db.relationships.count_documents({"case_id": cid})
        print(f" - Case ID: {cid} | Crime: {c.get('crime_type')} | Relationships count: {rel_count}")
        
    all_rel_cases = await db.relationships.distinct("case_id")
    print("Distinct case_ids in relationships:", all_rel_cases)

if __name__ == "__main__":
    asyncio.run(check_cases())
