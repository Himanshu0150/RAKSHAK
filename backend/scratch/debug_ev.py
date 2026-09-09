import asyncio
import sys
import os

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.mongodb import connect_to_mongo, get_database
from app.core.context_resolver import get_scoped_evidence
from app.core.evidence_pdf_generator import generate_case_evidence_export_pdf

async def debug():
    await connect_to_mongo()
    db = get_database()
    mongo_docs = await db.evidence.find({"case_id": "CASE-CYBER-8841"}, {"_id": 0}).to_list(100)
    print("Direct Mongo Docs count:", len(mongo_docs))
    for d in mongo_docs:
        print("  - Doc:", d)

    scoped_docs = await get_scoped_evidence("CASE-CYBER-8841", limit=100)
    print("Scoped Docs count:", len(scoped_docs))

    pdf_bytes = generate_case_evidence_export_pdf("CASE-CYBER-8841", "Test", mongo_docs)
    print("PDF bytes length:", len(pdf_bytes))
    print("Contains EVID-73E029F7 in raw pdf_bytes?", b"EVID-73E029F7" in pdf_bytes)

if __name__ == "__main__":
    asyncio.run(debug())
