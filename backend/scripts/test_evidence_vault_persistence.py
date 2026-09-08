import asyncio
import sys
import os
import hashlib
from httpx import AsyncClient, ASGITransport

# Add project backend root to path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.api.routes.auth import ACTIVE_TOKENS, DEFAULT_USERS

async def run_evidence_vault_tests():
    print("=" * 80)
    print("RUNNING EVIDENCE VAULT PERSISTENCE & AUTHORIZATION SUITE")
    print("=" * 80)

    # 1. Connect to MongoDB
    await connect_to_mongo()
    db = get_database()
    assert db is not None, "FAILED: MongoDB database connection is not available."
    print("[PASS] MongoDB Connection: ACTIVE")

    # Setup session tokens in memory / ACTIVE_TOKENS for testing
    lead_token = "test_lead_token_123"
    field_token = "test_field_token_456"

    ACTIVE_TOKENS[lead_token] = {
        "user": DEFAULT_USERS[0], # Sgt. Miller (Lead Investigator)
        "created_at": 1000000,
        "expires_at": 9999999999
    }
    ACTIVE_TOKENS[field_token] = {
        "user": DEFAULT_USERS[3], # Officer Watson (Field Agent) -> Authorized: ['CASE-CYBER-8841', 'C0001']
        "created_at": 1000000,
        "expires_at": 9999999999
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # TEST 1 & 2: Add a new evidence record via backend API (Lead Investigator)
        test_case_id = "CASE-CYBER-8841"
        test_desc = f"Test Forensic CCTV Disk Image - Ingest Unit Test {os.urandom(4).hex()}"
        test_type = "DIGITAL_CCTV"
        test_source = "National Cyber Crime Unit"

        print(f"\n[TEST 1 & 2] Adding new evidence record for case '{test_case_id}'...")
        payload = {
            "description": test_desc,
            "evidence_type": test_type,
            "case_id": test_case_id,
            "source": test_source
        }
        headers = {"Authorization": f"Bearer {lead_token}"}

        res = await ac.post("/api/evidence", json=payload, headers=headers)
        assert res.status_code == 200, f"FAILED: Create evidence POST failed ({res.status_code}): {res.text}"
        created_data = res.json()
        ev_id = created_data.get("evidence_id") or created_data.get("id")
        sha256 = created_data.get("integrity_sha256") or created_data.get("sha256Hash")

        assert ev_id and ev_id.startswith("EVID-"), f"FAILED: Invalid evidence_id returned: {ev_id}"
        assert sha256 and len(sha256) == 64, f"FAILED: Invalid SHA-256 hash returned: {sha256}"
        print(f"[PASS] Backend returned SUCCESS (200 OK): Created Evidence ID = '{ev_id}'")

        # TEST 3: Confirm the record exists in MongoDB
        print("\n[TEST 3] Verifying record existence in MongoDB 'evidence' collection...")
        mongo_doc = await db.evidence.find_one({"evidence_id": ev_id})
        assert mongo_doc is not None, f"FAILED: Evidence record '{ev_id}' was not found in MongoDB!"
        assert mongo_doc["case_id"] == test_case_id, f"FAILED: MongoDB case_id mismatch ({mongo_doc.get('case_id')})"
        assert mongo_doc["description"] == test_desc, f"FAILED: MongoDB description mismatch"
        print(f"[PASS] Record confirmed in MongoDB 'evidence' collection! (Doc ID: {ev_id})")

        # TEST 4 & 5: Refresh/Re-fetch evidence list from API
        print("\n[TEST 4 & 5] Fetching evidence list for case (simulating page refresh/relogin)...")
        res_list = await ac.get(f"/api/evidence?case_id={test_case_id}", headers=headers)
        assert res_list.status_code == 200, f"FAILED: GET evidence failed ({res_list.status_code})"
        evidence_list = res_list.json()
        
        found_ev = next((item for item in evidence_list if item.get("id") == ev_id or item.get("evidence_id") == ev_id), None)
        assert found_ev is not None, f"FAILED: Newly created evidence '{ev_id}' did not appear in GET list after refresh!"
        print(f"[PASS] Newly added evidence '{ev_id}' still appears after API refresh/re-fetch!")

        # TEST 6: Verify SHA-256 & integrity data preserved
        print("\n[TEST 6] Verifying SHA-256 & Custody Integrity metadata preservation...")
        assert found_ev.get("sha256Hash") == sha256, "FAILED: SHA-256 hash was altered or lost!"
        assert found_ev.get("verified") is True, "FAILED: Evidence verification status invalid"
        assert len(found_ev.get("custodyLogs", [])) > 0, "FAILED: Custody logs missing from evidence item"
        print(f"[PASS] SHA-256 ({sha256[:16]}...) and chain-of-custody logs preserved intact!")

        # TEST 7: Case Scoping & Authorization
        print("\n[TEST 7] Testing case-level RBAC & authorization safeguards...")
        # Field Agent authorized ONLY for ['CASE-CYBER-8841', 'C0001']
        field_headers = {"Authorization": f"Bearer {field_token}"}
        
        # Test authorized case access
        auth_res = await ac.post("/api/evidence", json={
            "description": "Authorized Field Collection",
            "evidence_type": "SURVEILLANCE",
            "case_id": "CASE-CYBER-8841"
        }, headers=field_headers)
        assert auth_res.status_code == 200, f"FAILED: Authorized field agent request failed: {auth_res.text}"
        print("[PASS] Authorized Field Agent POST to 'CASE-CYBER-8841' -> ALLOWED (200 OK)")

        # Test unauthorized case access
        unauth_res = await ac.post("/api/evidence", json={
            "description": "Unauthorized Access Test Evidence",
            "evidence_type": "SURVEILLANCE",
            "case_id": "CASE-NARCO-9921"
        }, headers=field_headers)
        assert unauth_res.status_code == 403, f"FAILED: Unauthorized case request was NOT blocked! Status: {unauth_res.status_code}"
        print("[PASS] Unauthorized Field Agent POST to 'CASE-NARCO-9921' -> REJECTED with HTTP 403 FORBIDDEN")

        # TEST 8: Verify no duplicate evidence is created on retry/re-submit
        print("\n[TEST 8] Testing deduplication on re-submitting duplicate evidence...")
        initial_count = await db.evidence.count_documents({"case_id": test_case_id})
        
        retry_res = await ac.post("/api/evidence", json=payload, headers=headers)
        assert retry_res.status_code == 200, f"FAILED: Retry POST failed ({retry_res.status_code})"
        retry_data = retry_res.json()
        assert retry_data.get("id") == ev_id, "FAILED: Duplicate request created a new record ID instead of returning existing!"
        
        final_count = await db.evidence.count_documents({"case_id": test_case_id})
        assert final_count == initial_count, f"FAILED: Duplicate record inserted into MongoDB! Count changed from {initial_count} to {final_count}"
        print("[PASS] Duplicate evidence submission returned existing record without inserting duplicate in MongoDB!")

    await close_mongo_connection()
    print("\n" + "=" * 80)
    print("ALL 8 EVIDENCE VAULT TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_evidence_vault_tests())
