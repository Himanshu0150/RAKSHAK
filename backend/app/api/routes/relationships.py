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
    if node_id.startswith("PERSON"): return "person"
    if node_id.startswith("ORG"): return "organization"
    if node_id.startswith("PHONE"): return "phone"
    if node_id.startswith("ACCT"): return "account"
    if node_id.startswith("VEH"): return "vehicle"
    if node_id.startswith("DEVICE"): return "device"
    if node_id.startswith("CASE"): return "case"
    if node_id.startswith("LOC"): return "location"
    return "entity"

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
            connected_pids = {n for n in visited if n.startswith("PERSON")}
        else:
            connected_pids = {n for n in adj.keys() if n.startswith("PERSON")}
            if not connected_pids:
                connected_pids = {e for e in case_entities if e.startswith("PERSON")}
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
            connected_pids = {n for n in visited if n.startswith("PERSON")}
        else:
            connected_pids = {n for n in adj.keys() if n.startswith("PERSON")}

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
        return {"found": False, "message": "Source and Target persons are required.", "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

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
        return {"found": False, "message": "No verified relationship path found for this case.", "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

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

        for nxt_node, link_obj in adj.get(curr_node, []):
            if nxt_node not in visited:
                visited.add(nxt_node)
                queue.append((nxt_node, curr_path + [nxt_node], curr_links + [link_obj]))

    if not found_nodes or not found_links:
        logger.info(f"[TRACE] case_id={c_id} source={src} target={tgt} edge_count={len(all_rels)} path_found=False path_length=0")
        return {"found": False, "message": "No verified relationship path found for this case.", "pathNodeIds": [], "nodes": [], "pathNodes": [], "edges": [], "pathLinks": [], "path": []}

    logger.info(f"[TRACE] case_id={c_id} source={src} target={tgt} edge_count={len(all_rels)} path_found=True path_length={len(found_nodes)}")

    path_nodes = []
    for nid in found_nodes:
        if nid.startswith("PERSON"):
            p_doc = await db.persons.find_one({"$or": [{"person_id": nid}, {"_id": nid}]}, {"_id": 0})
            if p_doc:
                path_nodes.append({"id": nid, "name": p_doc.get("name", nid), "type": "person", "attributes": p_doc})
                continue

        if nid.startswith("ORG"):
            o_doc = await db.organizations.find_one({"$or": [{"organization_id": nid}, {"_id": nid}]}, {"_id": 0})
            if o_doc:
                path_nodes.append({"id": nid, "name": o_doc.get("name", nid), "type": "organization", "attributes": o_doc})
                continue

        if nid.startswith("PHONE"):
            ph_doc = await db.phones.find_one({"$or": [{"phone_id": nid}, {"_id": nid}]}, {"_id": 0})
            if ph_doc:
                path_nodes.append({"id": nid, "name": ph_doc.get("phone_number", nid), "type": "phone", "attributes": ph_doc})
                continue

        if nid.startswith("ACCT"):
            acc_doc = await db.accounts.find_one({"$or": [{"account_id": nid}, {"_id": nid}]}, {"_id": 0})
            if acc_doc:
                path_nodes.append({"id": nid, "name": acc_doc.get("masked_identifier", nid), "type": "account", "attributes": acc_doc})
                continue

        if nid.startswith("VEH"):
            v_doc = await db.vehicles.find_one({"$or": [{"vehicle_id": nid}, {"_id": nid}]}, {"_id": 0})
            if v_doc:
                path_nodes.append({"id": nid, "name": f"{v_doc.get('make', '')} {v_doc.get('model', '')} ({nid})".strip(), "type": "vehicle", "attributes": v_doc})
                continue

        path_nodes.append({"id": nid, "name": nid, "type": derive_type(nid)})

    formatted_links = []
    for l in found_links:
        formatted_links.append({
            "id": l.get("relationship_id") or l.get("id"),
            "source": l.get("source_entity_id") or l.get("source"),
            "target": l.get("target_entity_id") or l.get("target"),
            "relationType": l.get("relationship_type") or l.get("relationType") or l.get("type") or "LINKED",
            "confidence": float(l.get("confidence", 0.95))
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
    limit: int = Query(150, ge=10, le=500),
    focus_id: Optional[str] = None,
    case_id: Optional[str] = None,
    relation_type: Optional[str] = Query(None, alias="type")
):
    db = get_database()
    if db is None:
        return {"nodes": [], "edges": [], "totalNodes": 0, "totalEdges": 0}

    limit_val = limit if isinstance(limit, int) else 150
    rel_type_str = relation_type if isinstance(relation_type, str) else None

    if case_id:
        rels, _, _ = await build_case_scoped_graph(case_id)
        if rel_type_str and rel_type_str.upper() != "ALL":
            import re
            rgx = re.compile(f"^{rel_type_str}$", re.IGNORECASE)
            rels = [r for r in rels if rgx.match(r.get("relationship_type", ""))]
    elif focus_id and isinstance(focus_id, str):
        rels = await get_scoped_relationships(entity_id=focus_id, limit=limit_val)
        if rel_type_str and rel_type_str.upper() != "ALL":
            import re
            rgx = re.compile(f"^{rel_type_str}$", re.IGNORECASE)
            rels = [r for r in rels if rgx.match(r.get("relationship_type", ""))]
    else:
        query = get_demo_filter("relationships", "relationship_id") if is_demo_enabled() else {}
        if rel_type_str and rel_type_str.upper() != "ALL":
            query["relationship_type"] = {"$regex": f"^{rel_type_str}$", "$options": "i"}
        cursor = db.relationships.find(query, {"_id": 0}).limit(limit_val)
        rels = await cursor.to_list(length=limit_val)

    node_ids = set()
    edges = []

    for r in rels:
        src = r.get("source_entity_id") or r.get("source")
        tgt = r.get("target_entity_id") or r.get("target")
        if src and tgt:
            if str(src).startswith("CASE-") or str(tgt).startswith("CASE-"):
                continue
            node_ids.add(src)
            node_ids.add(tgt)
            edges.append({
                "id": r.get("relationship_id") or f"{src}_{tgt}",
                "source": src,
                "target": tgt,
                "type": r.get("relationship_type", "LINKED"),
                "relationType": r.get("relationship_type", "LINKED"),
                "confidence": float(r.get("confidence", 0.95))
            })

    node_id_list = list(node_ids)
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
    logger.info(f"[GRAPH] case_id={case_id} relationship_count={len(rels)} node_count={len(nodes)} edge_count={len(edges)}")

    return {
        "nodes": nodes,
        "edges": edges,
        "totalNodes": len(nodes),
        "totalEdges": len(edges)
    }
