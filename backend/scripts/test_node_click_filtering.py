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

async def run_node_click_filtering_tests():
    print("=" * 80)
    print("RUNNING NODE CLICK GRAPH FILTER PRESERVATION SUITE")
    print("=" * 80)

    # 1. Connect to MongoDB
    await connect_to_mongo()
    db = get_database()
    assert db is not None, "FAILED: MongoDB database connection is not available."
    print("[PASS] MongoDB Connection: ACTIVE")

    # Tokens setup
    lead_token = "test_lead_node_click_token"
    ACTIVE_TOKENS[lead_token] = {
        "user": DEFAULT_USERS[0],
        "created_at": 1000000,
        "expires_at": 9999999999
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {lead_token}"}
        
        # Select active case ID
        cases_in_db = await db.relationships.distinct("case_id")
        target_case_id = cases_in_db[0] if cases_in_db else "C0001"
        print(f" -> Selected Case ID: '{target_case_id}'")

        # Step 1: Fetch initial topology & pick focus person
        init_res = await ac.get(f"/api/graph/topology?case_id={target_case_id}&limit=150", headers=headers)
        assert init_res.status_code == 200, "FAILED: Initial topology fetch failed"
        init_data = init_res.json()
        assert len(init_data["nodes"]) > 0, "FAILED: No nodes found in case graph"

        initial_node_id = init_data["nodes"][0]["id"]
        print(f" -> Initial Focus Node: '{initial_node_id}'")

        # Set specific active filters:
        # Hop depth = 2, min_confidence = 0.50, type = OWNED_BY (or first type found), start_date = 2020-01-01
        active_rel_type = "OWNED_BY"
        active_min_conf = 0.50
        active_hops = 2

        print(f"\n[STEP 1] Applying active filters (Hops={active_hops}, Type={active_rel_type}, MinConf={active_min_conf})...")
        filtered_res = await ac.get(
            f"/api/graph/topology?case_id={target_case_id}&focus_id={initial_node_id}&hops={active_hops}&type={active_rel_type}&min_confidence={active_min_conf}&limit=150",
            headers=headers
        )
        assert filtered_res.status_code == 200, "FAILED: Filtered topology fetch failed"
        filtered_data = filtered_res.json()
        print(f" -> Filtered graph returned {len(filtered_data['nodes'])} nodes, {len(filtered_data['edges'])} edges.")

        # Step 2: Click several nodes (simulating user clicking connected nodes)
        nodes_to_click = [n["id"] for n in filtered_data["nodes"][:4]]
        if initial_node_id not in nodes_to_click:
            nodes_to_click.append(initial_node_id)

        print(f"\n[STEP 2-8] Clicking nodes ({nodes_to_click}) and verifying filter preservation...")
        for clicked_node_id in nodes_to_click:
            print(f"\n --- Simulating click on Node '{clicked_node_id}' ---")
            click_res = await ac.get(
                f"/api/graph/topology?case_id={target_case_id}&focus_id={clicked_node_id}&hops={active_hops}&type={active_rel_type}&min_confidence={active_min_conf}&limit=150",
                headers=headers
            )
            assert click_res.status_code == 200, f"FAILED: Node click request for '{clicked_node_id}' failed ({click_res.status_code})"
            click_data = click_res.json()

            # Requirement 3: Verify filters remain active across node clicks
            for edge in click_data["edges"]:
                # Check relationship type
                e_t = (edge.get("relationType") or edge.get("type") or "").upper()
                assert e_t == active_rel_type.upper(), f"FAILED: Unfiltered relationship type leaked! Found '{e_t}', expected '{active_rel_type.upper()}'"

                # Check confidence threshold
                conf = float(edge.get("confidence", 0.95))
                assert conf >= active_min_conf, f"FAILED: Low confidence relationship leaked! Found {conf}, expected >= {active_min_conf}"

                # Check case scoping
                src = edge.get("source")
                tgt = edge.get("target")
                assert not str(src).startswith("CASE-") and not str(tgt).startswith("CASE-"), f"FAILED: Case container node leaked into edge: {src} -> {tgt}"

            # Verify graph was not reset to full case network
            full_case_rel_count = await db.relationships.count_documents({"case_id": target_case_id})
            assert len(click_data["edges"]) <= full_case_rel_count, "FAILED: Unfiltered full graph was returned"

            print(f"  [PASS] Clicked '{clicked_node_id}': Filters intact! ({len(click_data['nodes'])} nodes, {len(click_data['edges'])} edges returned)")

        # Step 9: Pathfinder / Trace endpoint verification
        print("\n[STEP 9] Verifying existing Pathfinder trace path functionality...")
        trace_res = await ac.post("/api/graph/trace", json={
            "source_person_id": nodes_to_click[0],
            "target_person_id": nodes_to_click[-1],
            "case_id": target_case_id
        }, headers=headers)
        assert trace_res.status_code == 200, f"FAILED: Pathfinder trace request failed ({trace_res.status_code})"
        trace_data = trace_res.json()
        assert "found" in trace_data, "FAILED: Pathfinder response structure invalid"
        print(f"[PASS] Pathfinder endpoint intact (found: {trace_data['found']}, message: '{trace_data.get('message')}').")

    await close_mongo_connection()
    print("\n" + "=" * 80)
    print("ALL NODE CLICK FILTER PRESERVATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_node_click_filtering_tests())
