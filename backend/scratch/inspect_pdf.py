import asyncio
import sys
import os
import base64
import zlib

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.mongodb import connect_to_mongo, get_database
from app.core.evidence_pdf_generator import generate_case_evidence_export_pdf

async def inspect():
    await connect_to_mongo()
    db = get_database()
    mongo_docs = await db.evidence.find({"case_id": "CASE-CYBER-8841"}, {"_id": 0}).to_list(100)
    pdf_bytes = generate_case_evidence_export_pdf("CASE-CYBER-8841", "Test", mongo_docs)
    
    s_pos = pdf_bytes.find(b"stream\n") + 7
    e_pos = pdf_bytes.find(b"~>endstream") + 2
    raw_stream = pdf_bytes[s_pos:e_pos]
    print("Raw ASCII85 Stream size:", len(raw_stream))
    
    a85_decoded = base64.a85decode(raw_stream, adobe=True)
    print("ASCII85 Decoded size:", len(a85_decoded))
    
    decomp = zlib.decompress(a85_decoded)
    print("Flate Decompressed size:", len(decomp))
    decomp_str = decomp.decode('latin-1', errors='ignore')
    
    for d in mongo_docs:
        ev_id = d.get("evidence_id") or d.get("id")
        sha256 = d.get("integrity_sha256") or d.get("sha256Hash")
        print(f"  [VERIFICATION] Ev ID '{ev_id}' present in PDF stream? -> {ev_id in decomp_str}")
        print(f"  [VERIFICATION] SHA-256 '{sha256[:16]}' present in PDF stream? -> {sha256[:16] in decomp_str}")

if __name__ == "__main__":
    asyncio.run(inspect())
