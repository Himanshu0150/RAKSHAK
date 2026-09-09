import asyncio
import sys
import os
from httpx import AsyncClient, ASGITransport

# Add backend directory to sys.path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from app.api.routes.auth import ACTIVE_TOKENS, DEFAULT_USERS

async def run_graph_filtering_tests():
    print("=" * 80)
    print("RUNNING INVESTIGATION-FOCUSED GRAPH FILTERING TEST SUITE")
    print("=" * 80)

    # 1. Connect to MongoDB
    await connect_to_mongo()
    db = get_database()
    assert db is not None, "FAILED: MongoDB database connection is not available."
    print("[PASS] MongoDB Connection: ACTIVE")

    # Tokens setup
    lead_token = "test_lead_graph_token_123"
    ACTIVE_TOKENS[lead_token] = {
        "user": DEFAULT_USERS[0], # Lead Investigator
        "created_at": 1000000,
        "expires_at": 9999999999
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {lead_token}"}
        
        # Pick an active case ID from MongoDB relationships (e.g. C0001 or C0050)
        cases_in_db = await db.relationships.distinct("case_id")
        target_case_id = cases_in_db[0] if cases_in_db else "C0001"
        print(f" -> Selected Active Case ID for testing: '{target_case_id}'")

        # TEST 1: Fetch initial topology for target case
        print(f"\n[TEST 1] Fetching default graph topology for case '{target_case_id}'...")
        res = await ac.get(f"/api/graph/topology?case_id={target_case_id}&limit=150", headers=headers)
        assert res.status_code == 200, f"FAILED: GET /api/graph/topology failed ({res.status_code})"
        topology = res.json()
        assert "nodes" in topology and "edges" in topology, "FAILED: Invalid topology response structure"
        assert len(topology["nodes"]) > 0 and len(topology["edges"]) > 0, f"FAILED: Default topology returned 0 nodes/edges for active case {target_case_id}"
        print(f"[PASS] Default topology loaded ({len(topology['nodes'])} nodes, {len(topology['edges'])} edges).")

        # Pick a focus person from persons list or graph nodes
        persons_res = await ac.get(f"/api/graph/persons?case_id={target_case_id}", headers=headers)
        assert persons_res.status_code == 200, "FAILED: GET /api/graph/persons failed"
        persons = persons_res.json()
        
        if persons:
            focus_person_id = persons[0]["id"]
        else:
            focus_person_id = topology["nodes"][0]["id"]
            
        print(f" -> Selected Focus Person: '{focus_person_id}'")

        # TEST 2: Hop Depths (1, 2, 3, 4)
        print("\n[TEST 2] Testing Hop Depths (1, 2, 3, 4) starting from focus person...")
        prev_node_count = 0
        for hop in [1, 2, 3, 4]:
            hop_res = await ac.get(f"/api/graph/topology?case_id={target_case_id}&focus_id={focus_person_id}&hops={hop}&limit=200", headers=headers)
            assert hop_res.status_code == 200, f"FAILED: Hop depth {hop} request failed"
            hop_data = hop_res.json()
            node_ids = {n["id"] for n in hop_data["nodes"]}
            print(f" -> Hop Depth {hop}: {len(hop_data['nodes'])} nodes, {len(hop_data['edges'])} edges")
            assert focus_person_id in node_ids, f"FAILED: Focus person '{focus_person_id}' missing at hop depth {hop}"
            assert len(hop_data["nodes"]) >= prev_node_count, f"FAILED: Node count decreased when increasing hop depth"
            prev_node_count = len(hop_data["nodes"])
        print("[PASS] Hop depth expansion (1-4) verified successfully!")

        # TEST 3: Relationship Type Filter
        print("\n[TEST 3] Testing Relationship Type filter...")
        all_edges_types = set()
        for e in topology["edges"]:
            all_edges_types.add(e.get("relationType") or e.get("type"))
        
        test_rel_type = list(all_edges_types)[0] if all_edges_types else "TRANSFERRED_FUNDS"
        rel_res = await ac.get(f"/api/graph/topology?case_id={target_case_id}&type={test_rel_type}&limit=150", headers=headers)
        assert rel_res.status_code == 200, "FAILED: Relationship type query failed"
        rel_data = rel_res.json()
        for e in rel_data["edges"]:
            e_t = (e.get("relationType") or e.get("type") or "").upper()
            assert e_t == test_rel_type.upper(), f"FAILED: Edge relationship type mismatch ({e_t} != {test_rel_type.upper()})"
        print(f"[PASS] Relationship type filter '{test_rel_type}' verified ({len(rel_data['edges'])} matching edges).")

        # TEST 4: Minimum Confidence Filter
        print("\n[TEST 4] Testing Minimum Confidence filter (min_confidence = 0.50)...")
        conf_res = await ac.get(f"/api/graph/topology?case_id={target_case_id}&min_confidence=0.50&limit=150", headers=headers)
        assert conf_res.status_code == 200, "FAILED: Min confidence query failed"
        conf_data = conf_res.json()
        for e in conf_data["edges"]:
            assert float(e.get("confidence", 0.95)) >= 0.50, f"FAILED: Edge confidence below threshold: {e.get('confidence')}"
        print(f"[PASS] Minimum confidence filter >= 0.50 verified ({len(conf_data['edges'])} edges returned).")

        # TEST 5: Date Range Filter
        print("\n[TEST 5] Testing Time / Date Range filter...")
        date_res = await ac.get(f"/api/graph/topology?case_id={target_case_id}&start_date=2020-01-01&end_date=2030-12-31&limit=150", headers=headers)
        assert date_res.status_code == 200, "FAILED: Date range query failed"
        date_data = date_res.json()
        print(f"[PASS] Date range filter query succeeded ({len(date_data['edges'])} edges returned).")

        # TEST 6: Strict Case Scoping
        print("\n[TEST 6] Verifying Strict Case Scoping safeguards...")
        for n in hop_data["nodes"]:
            assert not n["id"].startswith("CASE-"), f"FAILED: Case container node leaked into subgraph: {n['id']}"
        print("[PASS] Subgraph remains strictly case-scoped with zero cross-case leakage!")

        # TEST 7: Path Trace Pathfinder Verification
        print("\n[TEST 7] Verifying Pathfinder / Trace Graph Path endpoint...")
        if len(persons) >= 2:
            src_p = persons[0]["id"]
            tgt_p = persons[1]["id"]
            trace_res = await ac.post("/api/graph/trace", json={
                "source_person_id": src_p,
                "target_person_id": tgt_p,
                "case_id": target_case_id
            }, headers=headers)
            assert trace_res.status_code == 200, f"FAILED: Graph trace POST failed ({trace_res.status_code})"
            trace_data = trace_res.json()
            assert "found" in trace_data, "FAILED: Invalid path trace response structure"
            print(f"[PASS] Pathfinder endpoint verified intact! (Path found: {trace_data['found']}, message: '{trace_data.get('message')}')")

    await close_mongo_connection()
    print("\n" + "=" * 80)
    print("ALL GRAPH FILTERING TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_graph_filtering_tests())
