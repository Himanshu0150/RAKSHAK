import asyncio
import sys
import os
import hashlib
from httpx import AsyncClient, ASGITransport

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.api.routes.auth import ACTIVE_TOKENS, DEFAULT_USERS


async def run_blockchain_integrity_tests():
    print("=" * 80)
    print("RUNNING BLOCKCHAIN EVIDENCE INTEGRITY TEST SUITE")
    print("=" * 80)

    # 1. Connect to MongoDB
    await connect_to_mongo()
    db = get_database()
    assert db is not None, "FAILED: MongoDB database connection is not available."
    print("[PASS] MongoDB Connection: ACTIVE")

    # Setup session tokens in memory
    lead_token = "test_lead_token_bc_123"
    unauth_field_token = "test_field_token_bc_456"

    ACTIVE_TOKENS[lead_token] = {
        "user": DEFAULT_USERS[0],  # Sgt. Miller (Lead Investigator)
        "created_at": 1000000,
        "expires_at": 9999999999
    }
    ACTIVE_TOKENS[unauth_field_token] = {
        "user": DEFAULT_USERS[2],  # Officer Watson -> Authorized ONLY for ['CASE-CYBER-8841', 'C0001']
        "created_at": 1000000,
        "expires_at": 9999999999
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        lead_headers = {"Authorization": f"Bearer {lead_token}"}
        unauth_headers = {"Authorization": f"Bearer {unauth_field_token}"}

        # Step 1: Create a test evidence item
        test_case_id = "CASE-CYBER-8841"
        test_desc = f"Blockchain Evidence Anchor Test - Seized Drive {os.urandom(4).hex()}"
        print(f"\n[TEST 1] Creating test evidence record for case '{test_case_id}'...")
        
        create_res = await ac.post("/api/evidence", json={
            "description": test_desc,
            "evidence_type": "DIGITAL_CCTV",
            "case_id": test_case_id,
            "source": "Cyber Intercept Unit"
        }, headers=lead_headers)
        
        assert create_res.status_code == 200, f"FAILED: Create evidence failed ({create_res.status_code}): {create_res.text}"
        ev_data = create_res.json()
        ev_id = ev_data.get("evidence_id") or ev_data.get("id")
        orig_sha256 = ev_data.get("sha256Hash") or ev_data.get("integrity_sha256")
        
        assert ev_id and ev_id.startswith("EVID-"), f"FAILED: Invalid evidence ID: {ev_id}"
        assert orig_sha256 and len(orig_sha256) == 64, f"FAILED: Invalid SHA-256 hash: {orig_sha256}"
        print(f"[PASS] Evidence created successfully: ID = '{ev_id}', SHA-256 = '{orig_sha256[:16]}...'")

        # Step 2: Anchor Evidence Hash on Blockchain
        print(f"\n[TEST 2] Anchoring SHA-256 hash to blockchain via POST /api/evidence/{ev_id}/blockchain-anchor...")
        anchor_res = await ac.post(f"/api/evidence/{ev_id}/blockchain-anchor", headers=lead_headers)
        assert anchor_res.status_code == 200, f"FAILED: Anchor POST failed ({anchor_res.status_code}): {anchor_res.text}"
        
        anchor_data = anchor_res.json()
        assert anchor_data.get("blockchain_status") == "Anchored", f"FAILED: Unexpected status: {anchor_data.get('blockchain_status')}"
        assert anchor_data.get("blockchain_tx_hash"), "FAILED: Transaction hash missing in anchor response"
        assert anchor_data.get("anchored_hash") == orig_sha256, "FAILED: Anchored hash mismatch"
        tx_hash = anchor_data.get("blockchain_tx_hash")
        print(f"[PASS] Evidence anchored on-chain! Status: Anchored, TxHash: '{tx_hash[:18]}...'")

        # Step 3: Fetch Blockchain Status
        print(f"\n[TEST 3] Fetching status via GET /api/evidence/{ev_id}/blockchain-status...")
        status_res = await ac.get(f"/api/evidence/{ev_id}/blockchain-status", headers=lead_headers)
        assert status_res.status_code == 200, f"FAILED: Get status failed ({status_res.status_code})"
        status_data = status_res.json()
        assert status_data.get("anchored") is True, "FAILED: Evidence should report anchored=True"
        assert status_data.get("blockchain_tx_hash") == tx_hash, "FAILED: TxHash mismatch"
        print(f"[PASS] Blockchain status confirmed on-chain record: {status_data.get('blockchain_network')}")

        # Step 4: Verify Evidence Integrity (Matching SHA-256) -> Should return GREEN
        print(f"\n[TEST 4] Verifying evidence integrity (Matching SHA-256) -> Expecting GREEN...")
        verify_res = await ac.post(f"/api/evidence/{ev_id}/verify-blockchain", json={}, headers=lead_headers)
        assert verify_res.status_code == 200, f"FAILED: Verify POST failed ({verify_res.status_code})"
        verify_data = verify_res.json()
        assert verify_data.get("verified") is True, f"FAILED: Verification returned false"
        assert verify_data.get("status") == "Verified", f"FAILED: Expected 'Verified', got '{verify_data.get('status')}'"
        assert "✓ Evidence Integrity Verified" in verify_data.get("header", ""), "FAILED: Header mismatch"
        print(f"[PASS] GREEN Verification Output: Status '{verify_data.get('status')}' - Hash matches blockchain record!")

        # Step 5: Verify Evidence Integrity with Simulated Tampering -> Should return RED
        print(f"\n[TEST 5] Verifying evidence integrity with SIMULATED TAMPERING -> Expecting RED...")
        tamper_res = await ac.post(f"/api/evidence/{ev_id}/verify-blockchain", json={"tampered": True}, headers=lead_headers)
        assert tamper_res.status_code == 200, f"FAILED: Tamper verify POST failed ({tamper_res.status_code})"
        tamper_data = tamper_res.json()
        assert tamper_data.get("verified") is False, "FAILED: Tampered verification should return verified=False"
        assert tamper_data.get("status") == "Integrity Mismatch", f"FAILED: Expected 'Integrity Mismatch', got '{tamper_data.get('status')}'"
        assert "Evidence Integrity Check Failed" in tamper_data.get("header", ""), "FAILED: Tamper header mismatch"
        print(f"[PASS] RED Verification Output: Status '{tamper_data.get('status')}' - Hash mismatch correctly detected!")

        # Step 6: Test Authorization (RBAC Safeguard) for Unauthorized Case
        print(f"\n[TEST 6] Testing RBAC authorization for unauthorized case access...")
        unauth_case_id = "CASE-NARCO-9921"
        unauth_ev_res = await ac.post("/api/evidence", json={
            "description": "Unauthorized Case Evidence",
            "evidence_type": "SURVEILLANCE",
            "case_id": unauth_case_id
        }, headers=lead_headers)
        unauth_ev_id = unauth_ev_res.json().get("id")

        unauth_anchor_res = await ac.post(f"/api/evidence/{unauth_ev_id}/blockchain-anchor", headers=unauth_headers)
        assert unauth_anchor_res.status_code == 403, f"FAILED: Unauthorized anchor was not blocked! ({unauth_anchor_res.status_code})"
        print("[PASS] Unauthorized field agent request to anchor unauthorized case evidence was BLOCKED with HTTP 403 Forbidden!")

    await close_mongo_connection()
    print("\n" + "=" * 80)
    print("ALL BLOCKCHAIN EVIDENCE INTEGRITY TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_blockchain_integrity_tests())
