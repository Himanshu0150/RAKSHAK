from fastapi import APIRouter, Query
from typing import List, Optional
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter, is_demo_enabled
from app.core.context_resolver import resolve_context, get_scoped_relationships

router = APIRouter(tags=["Relationships & Graph"])

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

@router.get("/api/relationships", response_model=List[dict])
async def get_relationships(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    entity_id: Optional[str] = None,
    case_id: Optional[str] = None
):
    if case_id or entity_id:
        return await get_scoped_relationships(case_id=case_id, entity_id=entity_id, limit=limit, skip=skip)
    
    db = get_database()
    query = get_demo_filter("relationships", "relationship_id") if is_demo_enabled() else {}
    cursor = db.relationships.find(query, {"_id": 0}).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)

@router.get("/api/graph/topology", response_model=dict)
async def get_graph_topology(
    limit: int = Query(150, ge=10, le=500),
    focus_id: Optional[str] = None,
    case_id: Optional[str] = None
):
    db = get_database()
    if db is None:
        return {"nodes": [], "edges": [], "totalNodes": 0, "totalEdges": 0}

    if case_id or focus_id:
        ctx = await resolve_context(case_id=case_id, entity_id=focus_id)
        if not ctx.relationship_ids and not ctx.entity_ids:
            return {"nodes": [], "edges": [], "totalNodes": 0, "totalEdges": 0}

        rel_or_list = []
        if ctx.relationship_ids:
            rel_or_list.append({"relationship_id": {"$in": list(ctx.relationship_ids)}})
        if ctx.entity_ids:
            e_list = list(ctx.entity_ids)
            rel_or_list.append({"source_entity_id": {"$in": e_list}})
            rel_or_list.append({"target_entity_id": {"$in": e_list}})

        rels = await db.relationships.find({"$or": rel_or_list}, {"_id": 0}).limit(limit).to_list(length=limit)
    else:
        query = get_demo_filter("relationships", "relationship_id") if is_demo_enabled() else {}
        cursor = db.relationships.find(query, {"_id": 0}).limit(limit)
        rels = await cursor.to_list(length=limit)

    node_ids = set()
    edges = []

    for r in rels:
        src = r.get("source_entity_id")
        tgt = r.get("target_entity_id")
        if src and tgt:
            node_ids.add(src)
            node_ids.add(tgt)
            edges.append({
                "id": r.get("relationship_id"),
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

    return {
        "nodes": nodes,
        "edges": edges,
        "totalNodes": len(nodes),
        "totalEdges": len(edges)
    }
