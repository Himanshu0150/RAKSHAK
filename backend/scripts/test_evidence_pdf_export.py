import asyncio
import sys
import os
import base64
import zlib
import re
from httpx import AsyncClient, ASGITransport

# Add backend directory to sys.path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.api.routes.auth import ACTIVE_TOKENS, DEFAULT_USERS

def extract_pdf_text_streams(pdf_bytes: bytes) -> str:
    """Extract decompressed text from ReportLab PDF ASCII85 + Flate encoded streams."""
    extracted = []
    idx = 0
    while True:
        s_pos = pdf_bytes.find(b"stream", idx)
        if s_pos == -1:
            break
        e_pos = pdf_bytes.find(b"endstream", s_pos)
        if e_pos == -1:
            break
        
        # Find newline after stream keyword
        line_end = pdf_bytes.find(b"\n", s_pos, s_pos + 20)
        if line_end != -1:
            raw_data = pdf_bytes[line_end + 1:e_pos].strip()
            if not raw_data.endswith(b"~>"):
                raw_data += b"~>"
            try:
                a85 = base64.a85decode(raw_data, adobe=True)
                decomp = zlib.decompress(a85)
                extracted.append(decomp.decode('latin-1', errors='ignore'))
            except Exception:
                try:
                    decomp = zlib.decompress(raw_data)
                    extracted.append(decomp.decode('latin-1', errors='ignore'))
                except Exception:
                    pass
        idx = e_pos + 9

    return "\n".join(extracted)

async def run_evidence_pdf_export_tests():
    print("=" * 80)
    print("RUNNING EXPORT ALL EVIDENCE PDF & AUTHORIZATION TEST SUITE")
    print("=" * 80)

    # 1. Connect to MongoDB
    await connect_to_mongo()
    db = get_database()
    assert db is not None, "FAILED: MongoDB database connection is not available."
    print("[PASS] MongoDB Connection: ACTIVE")

    # Tokens setup
    # User 0: Lead Investigator (miller) -> Authorized for ALL cases
    # User 3: Officer Watson (Field Agent) -> Authorized ONLY for ['CASE-CYBER-8841', 'C0001']
    lead_token = "test_lead_pdf_token_789"
    field_token = "test_field_pdf_token_321"

    ACTIVE_TOKENS[lead_token] = {
        "user": DEFAULT_USERS[0],
        "created_at": 1000000,
        "expires_at": 9999999999
    }
    ACTIVE_TOKENS[field_token] = {
        "user": DEFAULT_USERS[3],
        "created_at": 1000000,
        "expires_at": 9999999999
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        lead_headers = {"Authorization": f"Bearer {lead_token}"}
        field_headers = {"Authorization": f"Bearer {field_token}"}

        # Step 1: Select a case containing multiple evidence records
        target_case_id = "CASE-CYBER-8841"
        other_case_id = "CASE-NARCO-9921"

        print(f"\n[STEP 1] Fetching evidence records from MongoDB for case '{target_case_id}'...")
        mongo_target_docs = await db.evidence.find({"case_id": target_case_id}, {"_id": 0}).to_list(length=1000)
        mongo_other_docs = await db.evidence.find({"case_id": other_case_id}, {"_id": 0}).to_list(length=1000)
        
        print(f" -> Found {len(mongo_target_docs)} records for '{target_case_id}' in MongoDB.")
        print(f" -> Found {len(mongo_other_docs)} records for '{other_case_id}' in MongoDB.")
        assert len(mongo_target_docs) > 0, f"FAILED: No evidence records found in MongoDB for {target_case_id}"

        # Step 2: Export All Evidence PDF for authorized case
        print(f"\n[STEP 2 & 3] Requesting /api/evidence/export-pdf?case_id={target_case_id} (Authorized)...")
        pdf_res = await ac.get(f"/api/evidence/export-pdf?case_id={target_case_id}", headers=lead_headers)
        assert pdf_res.status_code == 200, f"FAILED: GET /api/evidence/export-pdf failed ({pdf_res.status_code}): {pdf_res.text}"
        assert pdf_res.headers.get("content-type") == "application/pdf", "FAILED: Content-Type is not application/pdf"

        pdf_bytes = pdf_res.content
        assert len(pdf_bytes) > 0, "FAILED: Returned PDF byte stream is empty!"
        print(f"[PASS] PDF Export returned SUCCESS (200 OK), size: {len(pdf_bytes)} bytes.")

        full_pdf_text = extract_pdf_text_streams(pdf_bytes)

        print("\n[STEP 4] Verifying IDs, hashes and metadata in PDF match MongoDB...")
        for doc in mongo_target_docs:
            ev_id = doc.get("evidence_id") or doc.get("id")
            sha256 = doc.get("integrity_sha256") or doc.get("sha256Hash") or doc.get("hash")
            
            assert ev_id in full_pdf_text, f"FAILED: Evidence ID '{ev_id}' not found in PDF text!"
            if sha256:
                assert sha256[:16] in full_pdf_text or sha256 in full_pdf_text, f"FAILED: SHA-256 hash '{sha256[:16]}' not found in PDF text!"

        print(f"[PASS] All {len(mongo_target_docs)} target evidence IDs & SHA-256 hashes verified inside PDF!")

        # Step 5: Verify another case's evidence is NOT included
        print(f"\n[STEP 5] Verifying evidence from '{other_case_id}' is NOT included in PDF...")
        for doc in mongo_other_docs:
            ev_id = doc.get("evidence_id") or doc.get("id")
            if ev_id:
                assert ev_id not in full_pdf_text, f"FAILED: Leak detected! Evidence ID '{ev_id}' from another case appeared in PDF!"
        print(f"[PASS] Confirmed NO evidence from '{other_case_id}' was leaked in export PDF!")

        # Step 6: Test with an authorized vs unauthorized case (RBAC)
        print("\n[STEP 6] Testing RBAC / Case Authorization for Field Agent...")
        # Authorized case for Field Agent: CASE-CYBER-8841 -> 200 OK
        field_auth_res = await ac.get(f"/api/evidence/export-pdf?case_id={target_case_id}", headers=field_headers)
        assert field_auth_res.status_code == 200, f"FAILED: Field agent should be authorized for {target_case_id}, got {field_auth_res.status_code}"
        print(f"[PASS] Authorized Field Agent export for '{target_case_id}' -> 200 OK")

        # Unauthorized case for Field Agent: CASE-NARCO-9921 -> 403 Forbidden
        field_unauth_res = await ac.get(f"/api/evidence/export-pdf?case_id={other_case_id}", headers=field_headers)
        assert field_unauth_res.status_code == 403, f"FAILED: Field agent should NOT be authorized for {other_case_id}, got {field_unauth_res.status_code}"
        print(f"[PASS] Unauthorized Field Agent export for '{other_case_id}' -> 403 FORBIDDEN")

        # Step 7: Confirm existing Evidence Vault list and BSA certificate features still work
        print("\n[STEP 7] Verifying existing Evidence Vault API and BSA Certificate features...")
        ev_list_res = await ac.get(f"/api/evidence?case_id={target_case_id}", headers=lead_headers)
        assert ev_list_res.status_code == 200, f"FAILED: Evidence Vault list GET failed ({ev_list_res.status_code})"
        items = ev_list_res.json()
        assert len(items) > 0, "FAILED: Evidence Vault list returned empty"
        print(f"[PASS] Evidence Vault list API intact ({len(items)} items returned).")

        first_ev_id = items[0]["id"]
        gen_bsa_res = await ac.post(f"/api/evidence/{first_ev_id}/bsa-certificate/generate", headers=lead_headers)
        assert gen_bsa_res.status_code == 200, f"FAILED: BSA certificate POST generate failed ({gen_bsa_res.status_code})"
        
        bsa_res = await ac.get(f"/api/evidence/{first_ev_id}/bsa-certificate", headers=lead_headers)
        assert bsa_res.status_code == 200, f"FAILED: BSA certificate GET failed ({bsa_res.status_code})"
        bsa_json = bsa_res.json()
        assert bsa_json.get("evidence_id") == first_ev_id, "FAILED: BSA certificate mismatch"
        print(f"[PASS] Section 63 BSA Certificate endpoint intact (Cert ID: {bsa_json.get('certificate_id')}).")

    await close_mongo_connection()
    print("\n" + "=" * 80)
    print("ALL 7 TEST STEPS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_evidence_pdf_export_tests())
