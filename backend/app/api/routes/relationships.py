from fastapi import APIRouter, Query
from typing import List, Optional
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter, is_demo_enabled
from app.core.context_resolver import get_scoped_relationships

from pydantic import BaseModel
from collections import deque
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Relationships & Graph"])

class GraphTraceRequest(BaseModel):
    source_person_id: Optional[str] = None
    target_person_id: Optional[str] = None
    source: Optional[str] = None
    target: Optional[str] = None
    case_id: Optional[str] = None

def derive_type(node_id: str) -> str:
    if not node_id:
        return "entity"
    u = str(node_id).upper()
    if u.startswith("PERSON") or (u.startswith("P") and not u.startswith("PH") and not u.startswith("PERM")):
        return "person"
    if u.startswith("PHONE") or u.startswith("PH"):
        return "phone"
    if u.startswith("ACCT") or u.startswith("ACC"):
        return "account"
    if u.startswith("ORG") or (u.startswith("O") and not u.startswith("EV")):
        return "organization"
    if u.startswith("VEH") or u.startswith("V"):
        return "vehicle"
    if u.startswith("DEVICE") or u.startswith("D"):
        return "device"
    if u.startswith("LOC") or u.startswith("L"):
        return "location"
    if u.startswith("CASE") or u.startswith("C"):
        return "case"
    if u.startswith("EVENT") or u.startswith("EV"):
        return "event"
    if u.startswith("EVID") or (u.startswith("E") and not u.startswith("EV")):
        return "evidence"
    if u.startswith("CRIME"):
        return "crime"
    return "entity"

def is_person_id(node_id: str) -> bool:
    if not node_id:
        return False
    u = str(node_id).upper()
    return u.startswith("PERSON") or (u.startswith("P") and not u.startswith("PH") and not u.startswith("PERM"))

async def build_case_scoped_graph(case_id: str):
    """
    Build graph strictly for case_id from real MongoDB relationships.
    Excludes any intermediate CASE- nodes to prevent cross-case leakage.
    """
    db = get_database()
    if db is None:
        return [], {}, set()

    # 1. Direct case relationships: case_id == selected_case_id OR target/source == selected_case_id
    c_rels = await db.relationships.find({
        "$or": [
            {"case_id": case_id},
            {"target_entity_id": case_id},
            {"source_entity_id": case_id}
        ]
    }, {"_id": 0}).to_list(2000)

    case_entities = set()
    for r in c_rels:
        s = r.get("source_entity_id") or r.get("source")
        t = r.get("target_entity_id") or r.get("target")
        if s and not str(s).startswith("CASE-"):
            case_entities.add(str(s))
        if t and not str(t).startswith("CASE-"):
            case_entities.add(str(t))

    # 2. Interconnected relationships between case entities
    e_list = list(case_entities)
    inter_rels = []
    if e_list:
        inter_rels = await db.relationships.find({
            "source_entity_id": {"$in": e_list},
            "target_entity_id": {"$in": e_list}
        }, {"_id": 0}).to_list(3000)

    seen = set()
    all_rels = []
    for r in c_rels + inter_rels:
        s = r.get("source_entity_id") or r.get("source")
        t = r.get("target_entity_id") or r.get("target")
        if s and t:
            if str(s).startswith("CASE-") or str(t).startswith("CASE-"):
                continue
            rid = r.get("relationship_id") or f"{s}_{t}"
            key = f"{rid}_{s}_{t}"
            if key not in seen:
                seen.add(key)
                all_rels.append(r)

    adj = {}
    for r in all_rels:
        s = r.get("source_entity_id") or r.get("source")
        t = r.get("target_entity_id") or r.get("target")
        adj.setdefault(s, []).append((t, r))
        adj.setdefault(t, []).append((s, r))

    return all_rels, adj, case_entities

@router.get("/api/relationships", response_model=List[dict])
async def get_relationships(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    entity_id: Optional[str] = None,
    case_id: Optional[str] = None
):
    limit_val = limit if isinstance(limit, int) else 100
    skip_val = skip if isinstance(skip, int) else 0

    if case_id or entity_id:
        return await get_scoped_relationships(case_id=case_id, entity_id=entity_id, limit=limit_val, skip=skip_val)
    
    db = get_database()
    query = get_demo_filter("relationships", "relationship_id") if is_demo_enabled() else {}
    cursor = db.relationships.find(query, {"_id": 0}).skip(skip_val).limit(limit_val)
    return await cursor.to_list(length=limit_val)

@router.get("/api/graph/persons", response_model=List[dict])
async def get_graph_persons(
    case_id: Optional[str] = None,
    focus_person_id: Optional[str] = Query(None, alias="focus_id"),
    limit: int = Query(500, ge=1, le=3000)
):
    db = get_database()
    if db is None:
        return []

    limit_val = limit if isinstance(limit, int) else 500
    connected_pids = set()
    target_focus = focus_person_id if isinstance(focus_person_id, str) else None

    if case_id:
        all_rels, adj, case_entities = await build_case_scoped_graph(case_id)
        
        if target_focus and target_focus in adj:
            visited = {target_focus}
            queue = deque([(target_focus, 0)])
            while queue:
                curr, depth = queue.popleft()
                if depth >= 4:
                    continue
                for nxt, _ in adj.get(curr, []):
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append((nxt, depth + 1))
            connected_pids = {n for n in visited if is_person_id(n)}
        else:
            connected_pids = {n for n in adj.keys() if is_person_id(n)}
            if not connected_pids:
                connected_pids = {e for e in case_entities if is_person_id(e)}
    else:
        rels = await get_scoped_relationships(entity_id=target_focus, limit=2000)
        adj = {}
        for r in rels:
            s = r.get("source_entity_id") or r.get("source")
            t = r.get("target_entity_id") or r.get("target")
            if s and t:
                adj.setdefault(s, []).append((t, r))
                adj.setdefault(t, []).append((s, r))
        
        if target_focus and target_focus in adj:
            visited = {target_focus}
            queue = deque([(target_focus, 0)])
            while queue:
                curr, depth = queue.popleft()
                if depth >= 4:
                    continue
                for nxt, _ in adj.get(curr, []):
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append((nxt, depth + 1))
            connected_pids = {n for n in visited if is_person_id(n)}
        else:
            connected_pids = {n for n in adj.keys() if is_person_id(n)}

    demo_on = is_demo_enabled()
    if demo_on:
        from app.core.context_resolver import _filter_by_demo
        connected_pids = {pid for pid in connected_pids if _filter_by_demo(pid, demo_on)}

    logger.info(f"[PERSON FILTER] focus_person={target_focus} related_person_count={len(connected_pids)} related_person_ids={list(connected_pids)[:5]}")

    if not connected_pids:
        return []

    persons = await db.persons.find({
        "$or": [
            {"person_id": {"$in": list(connected_pids)}},
            {"_id": {"$in": list(connected_pids)}}
        ]
    }, {"_id": 0}).limit(limit_val).to_list(length=limit_val)

    found_pids = {p.get("person_id") or p.get("_id") for p in persons}
    res = []
    for p in persons:
        pid = p.get("person_id") or p.get("_id")
        name = p.get("name") or pid
        res.append({
            "id": pid,
            "person_id": pid,
            "name": name,
            "displayName": f"{name} — {pid}",
            "role": p.get("role", "ASSOCIATE"),
            "attributes": p
        })

    for pid in connected_pids:
        if pid not in found_pids:
            res.append({
                "id": pid,
                "person_id": pid,
                "name": pid,
                "displayName": pid,
                "role": "ASSOCIATE",
                "attributes": {"id": pid}
            })

    res.sort(key=lambda x: x["name"])
    return res

@router.api_route("/api/graph/trace", methods=["GET", "POST"], response_model=dict)
async def trace_graph_path(
    req: Optional[GraphTraceRequest] = None,
    source_person_id: Optional[str] = None,
    target_person_id: Optional[str] = None,
    case_id: Optional[str] = None
):
    db = get_database()
    if db is None:
        return {"found": False, "message": "Database not available.", "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

    src = (req.source_person_id or req.source if req else None) or source_person_id
    tgt = (req.target_person_id or req.target if req else None) or target_person_id
    c_id = (req.case_id if req else None) or case_id

    if not src or not tgt:
        return {"found": False, "message": "Source and Target entities are required.", "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

    if src == tgt:
        p_doc = await db.persons.find_one({"$or": [{"person_id": src}, {"_id": src}]}, {"_id": 0})
        name = p_doc.get("name") if p_doc else src
        single_node = {"id": src, "name": name, "type": derive_type(src)}
        return {
            "found": True,
            "message": "Source and target are identical.",
            "case_id": c_id,
            "pathNodeIds": [src],
            "nodes": [single_node],
            "pathNodes": [single_node],
            "edges": [],
            "pathLinks": [],
            "path": [single_node]
        }

    if c_id:
        all_rels, adj, _ = await build_case_scoped_graph(c_id)
    else:
        rels = await get_scoped_relationships(limit=2000)
        all_rels = rels
        adj = {}
        for r in rels:
            s_id = r.get("source_entity_id") or r.get("source")
            t_id = r.get("target_entity_id") or r.get("target")
            if s_id and t_id:
                if str(s_id).startswith("CASE-") or str(t_id).startswith("CASE-"):
                    continue
                adj.setdefault(s_id, []).append((t_id, r))
                adj.setdefault(t_id, []).append((s_id, r))

    if src not in adj or tgt not in adj:
        logger.info(f"[TRACE] case_id={c_id} source={src} target={tgt} edge_count={len(all_rels)} path_found=False path_length=0")
        msg = f"No valid path found between {src} and {tgt} within Case {c_id}." if c_id else "No verified relationship path found for the selected entities."
        return {"found": False, "message": msg, "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

    # BFS constrained to 1-4 hops max (max path length = 5 nodes)
    queue = deque([(src, [src], [])])
    visited = {src}
    found_nodes = None
    found_links = None

    while queue:
        curr_node, curr_path, curr_links = queue.popleft()
        if curr_node == tgt:
            found_nodes = curr_path
            found_links = curr_links
            break

        if len(curr_path) - 1 >= 4:
            continue

        for nxt_node, link_obj in adj.get(curr_node, []):
            if nxt_node not in visited:
                visited.add(nxt_node)
                queue.append((nxt_node, curr_path + [nxt_node], curr_links + [link_obj]))

    if not found_nodes or not found_links:
        logger.info(f"[TRACE] case_id={c_id} source={src} target={tgt} edge_count={len(all_rels)} path_found=False path_length=0")
        msg = f"No valid path found between {src} and {tgt} within Case {c_id} (max 4 hops)." if c_id else "No verified relationship path found."
        return {"found": False, "message": msg, "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

    logger.info(f"[TRACE] case_id={c_id} source={src} target={tgt} edge_count={len(all_rels)} path_found=True path_length={len(found_nodes)}")

    path_nodes = []
    for nid in found_nodes:
        if is_person_id(nid):
            p_doc = await db.persons.find_one({"$or": [{"person_id": nid}, {"_id": nid}]}, {"_id": 0})
            if p_doc:
                path_nodes.append({"id": nid, "name": p_doc.get("name", nid), "type": "person", "attributes": p_doc})
                continue

        if nid.startswith("ORG") or nid.startswith("O"):
            o_doc = await db.organizations.find_one({"$or": [{"organization_id": nid}, {"_id": nid}]}, {"_id": 0})
            if o_doc:
                path_nodes.append({"id": nid, "name": o_doc.get("name", nid), "type": "organization", "attributes": o_doc})
                continue

        if nid.startswith("PHONE") or nid.startswith("PH"):
            ph_doc = await db.phones.find_one({"$or": [{"phone_id": nid}, {"_id": nid}]}, {"_id": 0})
            if ph_doc:
                path_nodes.append({"id": nid, "name": ph_doc.get("phone_number", nid), "type": "phone", "attributes": ph_doc})
                continue

        if nid.startswith("ACCT") or nid.startswith("ACC"):
            acc_doc = await db.accounts.find_one({"$or": [{"account_id": nid}, {"_id": nid}]}, {"_id": 0})
            if acc_doc:
                path_nodes.append({"id": nid, "name": acc_doc.get("masked_identifier", nid), "type": "account", "attributes": acc_doc})
                continue

        if nid.startswith("VEH") or nid.startswith("V"):
            v_doc = await db.vehicles.find_one({"$or": [{"vehicle_id": nid}, {"_id": nid}]}, {"_id": 0})
            if v_doc:
                path_nodes.append({"id": nid, "name": f"{v_doc.get('make', '')} {v_doc.get('model', '')} ({nid})".strip(), "type": "vehicle", "attributes": v_doc})
                continue

        if nid.startswith("DEVICE") or nid.startswith("D"):
            d_doc = await db.devices.find_one({"$or": [{"device_id": nid}, {"_id": nid}]}, {"_id": 0})
            if d_doc:
                path_nodes.append({"id": nid, "name": f"Device ({d_doc.get('device_type', nid)})", "type": "device", "attributes": d_doc})
                continue

        if nid.startswith("LOC") or nid.startswith("L"):
            l_doc = await db.locations.find_one({"$or": [{"location_id": nid}, {"_id": nid}]}, {"_id": 0})
            if l_doc:
                path_nodes.append({"id": nid, "name": l_doc.get("location_name") or l_doc.get("address") or nid, "type": "location", "attributes": l_doc})
                continue

        path_nodes.append({"id": nid, "name": nid, "type": derive_type(nid)})

    formatted_links = []
    for l in found_links:
        ev_id = l.get("evidence_id")
        if str(ev_id).lower() in ("nan", "none", "null"):
            ev_id = None
        formatted_links.append({
            "id": l.get("relationship_id") or l.get("id"),
            "source": l.get("source_entity_id") or l.get("source"),
            "target": l.get("target_entity_id") or l.get("target"),
            "relationType": l.get("relationship_type") or l.get("relationType") or l.get("type") or "LINKED",
            "confidence": float(l.get("confidence", 0.95)),
            "evidenceId": ev_id,
            "timestamp": l.get("timestamp") or l.get("observed_at")
        })

    return {
        "found": True,
        "message": "Verified relationship path identified.",
        "case_id": c_id,
        "pathNodeIds": found_nodes,
        "nodes": path_nodes,
        "pathNodes": path_nodes,
        "edges": formatted_links,
        "pathLinks": formatted_links,
        "path": path_nodes
    }

@router.get("/api/graph/topology", response_model=dict)
async def get_graph_topology(
    limit: int = Query(150, ge=10, le=1000),
    focus_id: Optional[str] = None,
    case_id: Optional[str] = None,
    relation_type: Optional[str] = Query(None, alias="type"),
    hops: int = Query(2, ge=1, le=4),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Returns an investigation-focused case-scoped graph topology centered around an optional focus entity/person,
    constrained by strict BFS shortest path hop depth (1-4), relationship type multi-filtering, confidence threshold, and date range.
    Returns bounded subgraph where every returned node satisfies shortest_path_distance(focus_id, node) <= hop_depth.
    """
    db = get_database()
    target_focus = focus_id.strip() if focus_id and isinstance(focus_id, str) and focus_id.strip() else None
    target_case = case_id.strip() if case_id and isinstance(case_id, str) and case_id.strip() else None

    # Defensive extraction of query values
    limit_val = limit.default if hasattr(limit, "default") else limit
    limit_val = int(limit_val) if isinstance(limit_val, (int, float, str)) and str(limit_val).isdigit() else 150

    hops_val = hops.default if hasattr(hops, "default") else hops
    hops_val = int(hops_val) if isinstance(hops_val, (int, float, str)) and str(hops_val).isdigit() else 2
    hops_val = max(1, min(hops_val, 4))

    min_conf_val = min_confidence.default if hasattr(min_confidence, "default") else min_confidence
    try:
        min_conf_val = float(min_conf_val) if min_conf_val is not None else 0.0
    except (ValueError, TypeError):
        min_conf_val = 0.0
    if min_conf_val > 1.0:
        min_conf_val /= 100.0

    if db is None:
        return {
            "focus_id": target_focus,
            "hop_depth": hops_val,
            "nodes": [],
            "edges": [],
            "totalNodes": 0,
            "totalEdges": 0
        }

    # 1. Fetch candidate raw relationships
    raw_rels = []
    if target_case:
        raw_rels, _, _ = await build_case_scoped_graph(target_case)
    elif target_focus:
        # Iteratively fetch candidate relationships up to hops_val distance from target_focus in DB
        visited_eids = {target_focus}
        current_layer = {target_focus}
        all_candidate_rels = []
        seen_rel_ids = set()

        for _ in range(hops_val):
            if not current_layer:
                break
            layer_list = list(current_layer)
            query = {
                "$or": [
                    {"source_entity_id": {"$in": layer_list}},
                    {"target_entity_id": {"$in": layer_list}}
                ]
            }
            if is_demo_enabled():
                demo_flt = get_demo_filter("relationships", "relationship_id")
                if demo_flt:
                    query = {"$and": [query, demo_flt]}

            cursor = db.relationships.find(query, {"_id": 0}).limit(3000)
            layer_rels = await cursor.to_list(length=3000)

            next_layer = set()
            for r in layer_rels:
                rid = r.get("relationship_id") or f"{r.get('source_entity_id')}_{r.get('target_entity_id')}"
                if rid not in seen_rel_ids:
                    seen_rel_ids.add(rid)
                    all_candidate_rels.append(r)

                s = str(r.get("source_entity_id") or r.get("source") or "")
                t = str(r.get("target_entity_id") or r.get("target") or "")
                if s and not s.startswith("CASE-") and s not in visited_eids:
                    visited_eids.add(s)
                    next_layer.add(s)
                if t and not t.startswith("CASE-") and t not in visited_eids:
                    visited_eids.add(t)
                    next_layer.add(t)
            current_layer = next_layer

        raw_rels = all_candidate_rels
    else:
        query = get_demo_filter("relationships", "relationship_id") if is_demo_enabled() else {}
        cursor = db.relationships.find(query, {"_id": 0}).limit(3000)
        raw_rels = await cursor.to_list(length=3000)

    # 2. Filter candidate relationships by Type, Confidence, and Date Range BEFORE traversal/rendering
    filtered_rels = []
    rel_type_str = relation_type if isinstance(relation_type, str) else None
    allowed_types = set()
    if rel_type_str and rel_type_str.upper() != "ALL":
        allowed_types = {t.strip().upper() for t in rel_type_str.split(",") if t.strip()}

    s_date = start_date.strip() if start_date and isinstance(start_date, str) and start_date.strip() else None
    e_date = end_date.strip() if end_date and isinstance(end_date, str) and end_date.strip() else None

    for r in raw_rels:
        # Relationship Type check
        if allowed_types:
            r_type = (r.get("relationship_type") or r.get("relationType") or r.get("type") or "").upper()
            if r_type not in allowed_types:
                continue

        # Confidence check
        conf = float(r.get("confidence", 0.95))
        if conf < min_conf_val:
            continue

        # Date Range check
        if s_date or e_date:
            ts_str = str(r.get("timestamp") or r.get("observed_at") or r.get("date") or r.get("collection_date") or "")
            if ts_str:
                r_day = ts_str.split("T")[0]
                if s_date and r_day < s_date:
                    continue
                if e_date and r_day > e_date:
                    continue

        filtered_rels.append(r)

    # 3. Perform strict BFS Shortest Path Traversal if focus_id is specified
    final_nodes_set = set()
    final_rels = []

    if target_focus:
        adj = {}
        for r in filtered_rels:
            s = str(r.get("source_entity_id") or r.get("source") or "")
            t = str(r.get("target_entity_id") or r.get("target") or "")
            if s and t and not s.startswith("CASE-") and not t.startswith("CASE-"):
                adj.setdefault(s, []).append((t, r))
                adj.setdefault(t, []).append((s, r))

        # BFS shortest path distance computation
        distances = {target_focus: 0}
        queue = deque([target_focus])

        while queue:
            curr = queue.popleft()
            curr_dist = distances[curr]
            if curr_dist >= hops_val:
                continue
            for nxt, r in adj.get(curr, []):
                if nxt not in distances:
                    distances[nxt] = curr_dist + 1
                    queue.append(nxt)

        # STRICT BOUND: Every returned node MUST satisfy shortest_path_distance <= hops_val
        valid_nodes = {node for node, dist in distances.items() if dist <= hops_val}

        # STRICT BOUND: Every returned edge MUST connect nodes inside that bounded subgraph
        seen_edges_keys = set()
        bounded_rels = []
        for r in filtered_rels:
            s = str(r.get("source_entity_id") or r.get("source") or "")
            t = str(r.get("target_entity_id") or r.get("target") or "")
            if s in valid_nodes and t in valid_nodes:
                rid = r.get("relationship_id") or f"{s}_{t}"
                if rid not in seen_edges_keys:
                    seen_edges_keys.add(rid)
                    bounded_rels.append(r)

        final_nodes_set = valid_nodes
        final_rels = bounded_rels
    else:
        final_rels = filtered_rels
        for r in final_rels:
            s = str(r.get("source_entity_id") or r.get("source") or "")
            t = str(r.get("target_entity_id") or r.get("target") or "")
            if s and not s.startswith("CASE-"):
                final_nodes_set.add(s)
            if t and not t.startswith("CASE-"):
                final_nodes_set.add(t)

    # 4. Sort relationships by confidence descending (strongest first) and apply render limit
    final_rels.sort(key=lambda x: float(x.get("confidence", 0.95)), reverse=True)
    capped_rels = final_rels[:limit_val]

    # Format edges and collect node IDs strictly within bounded subgraph
    result_node_ids = set()
    if target_focus and target_focus in final_nodes_set:
        result_node_ids.add(target_focus)

    formatted_edges = []
    seen_formatted = set()

    for r in capped_rels:
        src = str(r.get("source_entity_id") or r.get("source") or "")
        tgt = str(r.get("target_entity_id") or r.get("target") or "")
        if src and tgt and not src.startswith("CASE-") and not tgt.startswith("CASE-"):
            if target_focus and (src not in final_nodes_set or tgt not in final_nodes_set):
                continue
            edge_key = f"{src}_{tgt}_{r.get('relationship_type', 'LINKED')}"
            if edge_key in seen_formatted:
                continue
            seen_formatted.add(edge_key)

            result_node_ids.add(src)
            result_node_ids.add(tgt)
            formatted_edges.append({
                "id": r.get("relationship_id") or f"{src}_{tgt}",
                "source": src,
                "target": tgt,
                "type": r.get("relationship_type") or r.get("relationType") or "LINKED",
                "relationType": r.get("relationship_type") or r.get("relationType") or "LINKED",
                "confidence": float(r.get("confidence", 0.95)),
                "timestamp": r.get("timestamp") or r.get("observed_at") or r.get("date")
            })

    # 5. Populate Node metadata for result_node_ids from MongoDB
    node_id_list = list(result_node_ids)
    nodes_map = {}

    if node_id_list:
        # 1. Query persons
        persons = await db.persons.find({"person_id": {"$in": node_id_list}}, {"_id": 0}).to_list(length=len(node_id_list))
        for p in persons:
            nodes_map[p["person_id"]] = {
                "id": p["person_id"],
                "name": p.get("name", p["person_id"]),
                "type": "person",
                "flaggedRisk": p.get("role", "ASSOCIATE").upper(),
                "attributes": p
            }

        # 2. Query organizations
        remaining = [nid for nid in node_id_list if nid not in nodes_map]
        if remaining:
            orgs = await db.organizations.find({"organization_id": {"$in": remaining}}, {"_id": 0}).to_list(length=len(remaining))
            for o in orgs:
                nodes_map[o["organization_id"]] = {
                    "id": o["organization_id"],
                    "name": o.get("name", o["organization_id"]),
                    "type": "organization",
                    "flaggedRisk": o.get("network_type", "COMMERCIAL").upper(),
                    "attributes": o
                }

        # 3. Query phones
        remaining = [nid for nid in node_id_list if nid not in nodes_map]
        if remaining:
            phones = await db.phones.find({"phone_id": {"$in": remaining}}, {"_id": 0}).to_list(length=len(remaining))
            for ph in phones:
                nodes_map[ph["phone_id"]] = {
                    "id": ph["phone_id"],
                    "name": ph.get("phone_number", ph["phone_id"]),
                    "type": "phone",
                    "flaggedRisk": "MEDIUM",
                    "attributes": ph
                }

        # 4. Query vehicles
        remaining = [nid for nid in node_id_list if nid not in nodes_map]
        if remaining:
            vehicles = await db.vehicles.find({"vehicle_id": {"$in": remaining}}, {"_id": 0}).to_list(length=len(remaining))
            for v in vehicles:
                nodes_map[v["vehicle_id"]] = {
                    "id": v["vehicle_id"],
                    "name": f"{v.get('make', '')} {v.get('model', '')} ({v['vehicle_id']})",
                    "type": "vehicle",
                    "flaggedRisk": "LOW",
                    "attributes": v
                }

        # 5. Query accounts
        remaining = [nid for nid in node_id_list if nid not in nodes_map]
        if remaining:
            accounts = await db.accounts.find({"account_id": {"$in": remaining}}, {"_id": 0}).to_list(length=len(remaining))
            for a in accounts:
                nodes_map[a["account_id"]] = {
                    "id": a["account_id"],
                    "name": a.get("masked_identifier", a["account_id"]),
                    "type": "account",
                    "flaggedRisk": "LOW",
                    "attributes": a
                }

        # 6. Query devices
        remaining = [nid for nid in node_id_list if nid not in nodes_map]
        if remaining:
            devs = await db.devices.find({"device_id": {"$in": remaining}}, {"_id": 0}).to_list(length=len(remaining))
            for d in devs:
                nodes_map[d["device_id"]] = {
                    "id": d["device_id"],
                    "name": f"Device ({d['device_id']})",
                    "type": "device",
                    "flaggedRisk": "LOW",
                    "attributes": d
                }

        # 7. Query cases
        remaining = [nid for nid in node_id_list if nid not in nodes_map]
        if remaining:
            cases_list = await db.cases.find({"case_id": {"$in": remaining}}, {"_id": 0}).to_list(length=len(remaining))
            for c in cases_list:
                nodes_map[c["case_id"]] = {
                    "id": c["case_id"],
                    "name": f"Case ({c['case_id']})",
                    "type": "case",
                    "flaggedRisk": c.get("severity", "HIGH").upper(),
                    "attributes": c
                }

        # Fallback placeholders for remaining node IDs
        for nid in node_id_list:
            if nid not in nodes_map:
                nodes_map[nid] = {
                    "id": nid,
                    "name": nid,
                    "type": derive_type(nid),
                    "flaggedRisk": "LOW",
                    "attributes": {"id": nid}
                }

    nodes = list(nodes_map.values())
    logger.info(f"[GRAPH FILTERED] case_id={target_case} focus_id={target_focus} hops={hops_val} min_conf={min_conf_val} dates=({s_date} to {e_date}) rels_returned={len(formatted_edges)} node_count={len(nodes)}")

    return {
        "focus_id": target_focus,
        "hop_depth": hops_val,
        "nodes": nodes,
        "edges": formatted_edges,
        "totalNodes": len(nodes),
        "totalEdges": len(formatted_edges)
    }

