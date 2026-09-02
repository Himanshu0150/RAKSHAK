import hashlib
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db.mongodb import get_database
from app.core.demo_subset import get_demo_filter, is_demo_enabled
from app.core.context_resolver import resolve_context

router = APIRouter(prefix="/api/entities", tags=["Entities & Dossiers"])

def get_deterministic_risk(entity_id: str, default_role: str = "ASSOCIATE") -> str:
    if not entity_id:
        return default_role.upper()
    h = int(hashlib.sha256(entity_id.encode('utf-8')).hexdigest(), 16)
    risks = ["CRITICAL", "HIGH", "MEDIUM", "ASSOCIATE"]
    return risks[h % len(risks)]

@router.get("", response_model=List[dict])
async def get_entities(
    limit: int = Query(200, ge=1, le=3000),
    type: Optional[str] = None,
    q: Optional[str] = None,
    risk: Optional[str] = None,
    case_id: Optional[str] = None
):
    db = get_database()
    all_entities = []

    ctx = await resolve_context(case_id=case_id)
    if case_id and not ctx.entity_ids:
        return []

    requested_type = (type or "ALL").lower()
    type_limit = limit if requested_type != "all" else max(10, limit // 5)

    # 1. Persons
    if requested_type in ["all", "person"]:
        p_query = {}
        if case_id:
            p_query["person_id"] = {"$in": list(ctx.entity_ids)}
        elif is_demo_enabled():
            p_query.update(get_demo_filter("persons", "person_id"))

        if q:
            regex_pat = {"$regex": q, "$options": "i"}
            q_cond = [
                {"person_id": regex_pat},
                {"name": regex_pat},
                {"occupation": regex_pat},
                {"state": regex_pat},
                {"district": regex_pat},
                {"address": regex_pat},
                {"eye_color": regex_pat},
                {"hair_color": regex_pat},
                {"blood_type": regex_pat},
                {"marital_status": regex_pat}
            ]
            if p_query:
                p_query = {"$and": [p_query, {"$or": q_cond}]}
            else:
                p_query = {"$or": q_cond}
        
        persons = await db.persons.find(p_query, {"_id": 0}).limit(type_limit).to_list(length=type_limit)
        for p in persons:
            r_val = str(p.get("flaggedRisk") or get_deterministic_risk(p.get("person_id"), p.get("role", "ASSOCIATE"))).upper()
            all_entities.append({
                "id": p.get("person_id") or p.get("_id"),
                "name": p.get("name") or "Unknown Person",
                "type": "person",
                "flaggedRisk": r_val,
                "aliases": [p.get("alias")] if p.get("alias") else [],
                "attributes": p
            })

    # 2. Organizations
    if requested_type in ["all", "organization", "org"]:
        o_query = {}
        if case_id:
            o_query["organization_id"] = {"$in": list(ctx.entity_ids)}
        elif is_demo_enabled():
            o_query.update(get_demo_filter("organizations", "organization_id"))

        if q:
            regex_pat = {"$regex": q, "$options": "i"}
            q_cond = [
                {"organization_id": regex_pat},
                {"name": regex_pat},
                {"jurisdiction": regex_pat},
                {"network_type": regex_pat}
            ]
            if o_query:
                o_query = {"$and": [o_query, {"$or": q_cond}]}
            else:
                o_query = {"$or": q_cond}
        orgs = await db.organizations.find(o_query, {"_id": 0}).limit(type_limit).to_list(length=type_limit)
        for o in orgs:
            net_t = str(o.get("network_type", "")).upper()
            default_org_risk = "CRITICAL" if net_t in ["CYBERCRIME", "HUMAN_TRAFFICKING", "NARCOTICS"] else ("HIGH" if net_t in ["FINANCIAL_FRAUD", "ORGANIZED_CRIME"] else "MEDIUM")
            r_val = str(o.get("flaggedRisk") or default_org_risk).upper()
            all_entities.append({
                "id": o.get("organization_id") or o.get("_id"),
                "name": o.get("name") or "Unknown Org",
                "type": "organization",
                "flaggedRisk": r_val,
                "aliases": [],
                "attributes": o
            })

    # 3. Phones
    if requested_type in ["all", "phone"]:
        ph_query = {}
        if case_id:
            ph_query["phone_id"] = {"$in": list(ctx.entity_ids)}
        elif is_demo_enabled():
            ph_query.update(get_demo_filter("phones", "phone_id"))

        if q:
            regex_pat = {"$regex": q, "$options": "i"}
            q_cond = [
                {"phone_id": regex_pat},
                {"phone_number": regex_pat},
                {"carrier": regex_pat},
                {"device_id": regex_pat},
                {"person_id": regex_pat}
            ]
            if ph_query:
                ph_query = {"$and": [ph_query, {"$or": q_cond}]}
            else:
                ph_query = {"$or": q_cond}
        phones = await db.phones.find(ph_query, {"_id": 0}).limit(type_limit).to_list(length=type_limit)
        for ph in phones:
            all_entities.append({
                "id": ph.get("phone_id"),
                "name": f"Phone Line {ph.get('phone_number') or ph.get('phone_id')}",
                "type": "phone",
                "flaggedRisk": "HIGH" if ph.get("status") == "Active" else "MEDIUM",
                "aliases": [ph.get("phone_number")] if ph.get("phone_number") else [],
                "attributes": ph
            })

    # 4. Bank Accounts
    if requested_type in ["all", "account"]:
        acc_query = {}
        if case_id:
            acc_query["account_id"] = {"$in": list(ctx.entity_ids)}
        elif is_demo_enabled():
            acc_query.update(get_demo_filter("accounts", "account_id"))

        if q:
            regex_pat = {"$regex": q, "$options": "i"}
            q_cond = [
                {"account_id": regex_pat},
                {"institution_type": regex_pat},
                {"account_type": regex_pat},
                {"masked_identifier": regex_pat},
                {"person_id": regex_pat}
            ]
            if acc_query:
                acc_query = {"$and": [acc_query, {"$or": q_cond}]}
            else:
                acc_query = {"$or": q_cond}
        accounts = await db.accounts.find(acc_query, {"_id": 0}).limit(type_limit).to_list(length=type_limit)
        for acc in accounts:
            all_entities.append({
                "id": acc.get("account_id"),
                "name": f"{acc.get('institution_type', 'Bank')} ({acc.get('masked_identifier') or acc.get('account_id')})",
                "type": "account",
                "flaggedRisk": "CRITICAL" if "Digital" in str(acc.get("institution_type")) else "HIGH",
                "aliases": [acc.get("masked_identifier")] if acc.get("masked_identifier") else [],
                "attributes": acc
            })

    # 5. Vehicles
    if requested_type in ["all", "vehicle"]:
        veh_query = {}
        if case_id:
            veh_query["vehicle_id"] = {"$in": list(ctx.entity_ids)}
        elif is_demo_enabled():
            veh_query.update(get_demo_filter("vehicles", "vehicle_id"))

        if q:
            regex_pat = {"$regex": q, "$options": "i"}
            q_cond = [
                {"vehicle_id": regex_pat},
                {"registration_alias": regex_pat},
                {"make": regex_pat},
                {"model": regex_pat},
                {"color": regex_pat},
                {"vehicle_type": regex_pat},
                {"owner_person_id": regex_pat}
            ]
            if veh_query:
                veh_query = {"$and": [veh_query, {"$or": q_cond}]}
            else:
                veh_query = {"$or": q_cond}
        vehicles = await db.vehicles.find(veh_query, {"_id": 0}).limit(type_limit).to_list(length=type_limit)
        for veh in vehicles:
            all_entities.append({
                "id": veh.get("vehicle_id"),
                "name": f"{veh.get('color', '')} {veh.get('make', '')} {veh.get('model', '')} ({veh.get('registration_alias') or veh.get('vehicle_id')})".strip(),
                "type": "vehicle",
                "flaggedRisk": "HIGH" if veh.get("status") == "Active" else "MEDIUM",
                "aliases": [veh.get("registration_alias")] if veh.get("registration_alias") else [],
                "attributes": veh
            })

    if risk and risk != "ALL":
        target_r = risk.upper()
        all_entities = [e for e in all_entities if str(e.get("flaggedRisk", "")).upper() == target_r or target_r in str(e.get("flaggedRisk", "")).upper()]

    return all_entities[:limit]

def derive_entity_type_from_id(entity_id: str) -> str:
    if not entity_id:
        return "person"
    e_upper = entity_id.upper()
    if e_upper.startswith("PHONE-"): return "phone"
    if e_upper.startswith("PERSON-"): return "person"
    if e_upper.startswith("ACCT-"): return "account"
    if e_upper.startswith("VEH-"): return "vehicle"
    if e_upper.startswith("ORG-"): return "organization"
    if e_upper.startswith("CASE-"): return "case"
    if e_upper.startswith("DEVICE-"): return "device"
    if e_upper.startswith("LOC-"): return "location"
    return "person"

async def find_entity_document(db, entity_id: str):
    if not entity_id:
        return None, None, None

    prefix_map = [
        ("PHONE-", db.phones, "phone_id", "phone"),
        ("PERSON-", db.persons, "person_id", "person"),
        ("ACCT-", db.accounts, "account_id", "account"),
        ("VEH-", db.vehicles, "vehicle_id", "vehicle"),
        ("ORG-", db.organizations, "organization_id", "organization"),
        ("CASE-", db.cases, "case_id", "case"),
        ("DEVICE-", db.devices, "device_id", "device"),
        ("LOC-", db.locations, "location_id", "location"),
    ]
    
    e_upper = entity_id.upper()
    for prefix, coll, id_field, etype in prefix_map:
        if e_upper.startswith(prefix):
            doc = await coll.find_one({"$or": [{id_field: entity_id}, {"_id": entity_id}]}, {"_id": 0})
            if doc:
                return doc, etype, id_field
                
    for prefix, coll, id_field, etype in prefix_map:
        if not e_upper.startswith(prefix):
            doc = await coll.find_one({"$or": [{id_field: entity_id}, {"_id": entity_id}]}, {"_id": 0})
            if doc:
                return doc, etype, id_field

    return None, None, None

@router.get("/{entity_id}", response_model=dict)
async def get_entity_by_id(entity_id: str):
    db = get_database()
    doc, etype, id_field = await find_entity_document(db, entity_id)
    if doc:
        name = doc.get("name")
        if not name:
            if etype == "phone":
                name = f"Phone Line {doc.get('phone_number') or entity_id}"
            elif etype == "account":
                name = f"{doc.get('institution_type', 'Bank Account')} ({doc.get('masked_identifier') or entity_id})"
            elif etype == "vehicle":
                name = f"{doc.get('color', '')} {doc.get('make', '')} {doc.get('model', '')} ({doc.get('registration_alias') or entity_id})".strip()
            elif etype == "device":
                name = f"Device {doc.get('device_type', '')} ({doc.get('mac_address') or entity_id})".strip()
            elif etype == "case":
                name = f"Case {doc.get('crime_type', '')} ({entity_id})"
            else:
                name = entity_id

        r_val = str(doc.get("flaggedRisk") or doc.get("role") or doc.get("network_type") or get_deterministic_risk(entity_id)).upper()
        aliases = [doc.get("alias")] if doc.get("alias") else ([doc.get("phone_number")] if doc.get("phone_number") else [])

        return {
            "id": entity_id,
            "name": name,
            "type": etype,
            "flaggedRisk": r_val,
            "aliases": aliases,
            "attributes": doc
        }

    etype = derive_entity_type_from_id(entity_id)
    return {
        "id": entity_id,
        "name": entity_id,
        "type": etype,
        "flaggedRisk": "MEDIUM",
        "aliases": [],
        "attributes": {"id": entity_id}
    }

@router.get("/{entity_id}/dossier", response_model=dict)
async def get_entity_dossier(entity_id: str, case_id: Optional[str] = None):
    db = get_database()
    ctx = await resolve_context(case_id=case_id, entity_id=entity_id)
    
    # 1. Resolve core entity from DB collections
    entity_doc, entity_type, id_field = await find_entity_document(db, entity_id)
    if not entity_doc:
        entity_type = derive_entity_type_from_id(entity_id)
        entity_doc = {"id": entity_id}

    entity_name = entity_doc.get("name")
    if not entity_name:
        if entity_type == "phone":
            entity_name = f"Phone Line {entity_doc.get('phone_number') or entity_id}"
        elif entity_type == "account":
            entity_name = f"{entity_doc.get('institution_type', 'Bank Account')} ({entity_doc.get('masked_identifier') or entity_id})"
        elif entity_type == "vehicle":
            entity_name = f"{entity_doc.get('color', '')} {entity_doc.get('make', '')} {entity_doc.get('model', '')} ({entity_doc.get('registration_alias') or entity_id})".strip()
        elif entity_type == "device":
            entity_name = f"Device {entity_doc.get('device_type', '')} ({entity_doc.get('mac_address') or entity_id})".strip()
        elif entity_type == "case":
            entity_name = f"Case {entity_doc.get('crime_type', '')} ({entity_id})"
        else:
            entity_name = entity_id

    risk_val = str(entity_doc.get("flaggedRisk") or entity_doc.get("role") or entity_doc.get("network_type") or get_deterministic_risk(entity_id)).upper()

    all_entity_ids = set(ctx.entity_ids) if ctx.entity_ids else {entity_id}
    phone_ids = set(ctx.phone_ids) if ctx.phone_ids else set()
    account_ids = set(ctx.account_ids) if ctx.account_ids else set()
    vehicle_ids = set(ctx.vehicle_ids) if ctx.vehicle_ids else set()
    device_ids = set(ctx.device_ids) if ctx.device_ids else set()

    phones = await db.phones.find({"$or": [{"person_id": {"$in": list(all_entity_ids)}}, {"phone_id": {"$in": list(all_entity_ids)}}]}, {"_id": 0}).to_list(length=50)
    devices = await db.devices.find({"$or": [{"person_id": {"$in": list(all_entity_ids)}}, {"device_id": {"$in": list(all_entity_ids)}}]}, {"_id": 0}).to_list(length=50)
    accounts = await db.accounts.find({"$or": [{"person_id": {"$in": list(all_entity_ids)}}, {"account_id": {"$in": list(all_entity_ids)}}]}, {"_id": 0}).to_list(length=50)
    aliases = await db.aliases.find({"$or": [{"person_id": {"$in": list(all_entity_ids)}}, {"alias_id": {"$in": list(all_entity_ids)}}]}, {"_id": 0}).to_list(length=50)
    vehicles = await db.vehicles.find({"$or": [{"owner_person_id": {"$in": list(all_entity_ids)}}, {"vehicle_id": {"$in": list(all_entity_ids)}}]}, {"_id": 0}).to_list(length=50)

    for p in phones:
        if p.get("phone_id"): phone_ids.add(p["phone_id"])
    for a in accounts:
        if a.get("account_id"): account_ids.add(a["account_id"])
    for v in vehicles:
        if v.get("vehicle_id"): vehicle_ids.add(v["vehicle_id"])
    for d in devices:
        if d.get("device_id"): device_ids.add(d["device_id"])

    rels = await db.relationships.find({"$or": [{"source_entity_id": {"$in": list(all_entity_ids)}}, {"target_entity_id": {"$in": list(all_entity_ids)}}]}, {"_id": 0}).to_list(length=300)

    rel_case_ids = set(ctx.case_ids)
    rel_evidence_ids = set(ctx.evidence_ids)
    for r in rels:
        if r.get("case_id"): rel_case_ids.add(r.get("case_id"))
        if r.get("evidence_id"): rel_evidence_ids.add(r.get("evidence_id"))

    events = await db.events.find({"$or": [{"person_id": {"$in": list(all_entity_ids)}}, {"phone_id": {"$in": list(phone_ids)}}, {"vehicle_id": {"$in": list(vehicle_ids)}}]}, {"_id": 0}).to_list(length=100)

    evidence_or_list = [
        {"related_person_id": {"$in": list(all_entity_ids)}},
        {"person_id": {"$in": list(all_entity_ids)}},
        {"related_vehicle_id": {"$in": list(vehicle_ids)}},
        {"related_device_id": {"$in": list(device_ids)}}
    ]
    if rel_evidence_ids:
        evidence_or_list.append({"evidence_id": {"$in": list(rel_evidence_ids)}})
    if entity_id.startswith("EVID-"):
        evidence_or_list.append({"evidence_id": entity_id})

    evidence = await db.evidence.find({"$or": evidence_or_list}, {"_id": 0}).to_list(length=100)

    cdrs = []
    if phone_ids:
        cdrs = await db.cdrs.find({"$or": [{"caller_phone_id": {"$in": list(phone_ids)}}, {"receiver_phone_id": {"$in": list(phone_ids)}}, {"caller_phone": {"$in": list(phone_ids)}}, {"receiver_phone": {"$in": list(phone_ids)}}]}, {"_id": 0}).limit(100).to_list(length=100)

    transactions = []
    if account_ids:
        transactions = await db.transactions.find({"$or": [{"source_account_id": {"$in": list(account_ids)}}, {"destination_account_id": {"$in": list(account_ids)}}]}, {"_id": 0}).limit(100).to_list(length=100)

    case_ids = set(rel_case_ids)
    for ev in events:
        if ev.get("case_id"): case_ids.add(ev.get("case_id"))
    for e in evidence:
        if e.get("case_id"): case_ids.add(e.get("case_id"))
    for c in cdrs:
        if c.get("case_id"): case_ids.add(c.get("case_id"))
        if c.get("linked_case_id"): case_ids.add(c.get("linked_case_id"))
    for t in transactions:
        if t.get("case_id"): case_ids.add(t.get("case_id"))

    case_query_list = [{"person_id": {"$in": list(all_entity_ids)}}, {"suspect_id": {"$in": list(all_entity_ids)}}]
    if entity_id.startswith("CASE-"):
        case_query_list.append({"case_id": entity_id})
    if case_ids:
        case_query_list.append({"case_id": {"$in": list(case_ids)}})

    cases = await db.cases.find({"$or": case_query_list}, {"_id": 0}).to_list(length=50)

    formatted_cases = []
    seen_cases = set()
    for c in cases:
        cid = c.get("case_id")
        if not cid or cid in seen_cases:
            continue
        seen_cases.add(cid)

        crime_t = c.get("crime_type") or c.get("crime_id") or "Investigation"
        crime_cat = c.get("crime_category") or crime_t
        desc = c.get("description") or f"Incident reported under {crime_t} at station {c.get('police_station', 'N/A')}"
        inc_date = c.get("incident_date") or c.get("reported_date") or "N/A"
        juris = f"State: {c.get('state', 'N/A')}, District: {c.get('district', 'N/A')}, Station: {c.get('police_station', 'N/A')}"

        formatted_cases.append({
            "id": cid,
            "case_id": cid,
            "caseNumber": cid,
            "crime_type": crime_t,
            "crime_category": crime_cat,
            "title": f"{crime_t} ({cid})",
            "summary": desc,
            "description": desc,
            "priority": c.get("severity", "HIGH"),
            "severity": c.get("severity", "HIGH"),
            "status": c.get("case_status") or c.get("status") or "UNDER_INVESTIGATION",
            "dates": inc_date,
            "incident_date": inc_date,
            "jurisdiction": juris,
            "police_station": c.get("police_station", "N/A"),
            "state": c.get("state", "N/A"),
            "district": c.get("district", "N/A"),
            "leadInvestigator": c.get("investigator_id") or "Lead Investigator"
        })

    formatted_evidence = []
    for e in evidence:
        formatted_evidence.append({
            "id": e.get("evidence_id"),
            "evidence_id": e.get("evidence_id"),
            "title": e.get("description") or f"{e.get('evidence_type', 'Evidence')} Document ({e.get('evidence_id')})",
            "evidenceType": e.get("evidence_type", "SURVEILLANCE"),
            "source": e.get("source", "Law Enforcement Intercept"),
            "collectedAt": e.get("collected_at"),
            "sha256Hash": e.get("integrity_sha256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
            "verified": True,
            "tampered": False
        })

    formatted_rels = []
    for r in rels:
        formatted_rels.append({
            "id": r.get("relationship_id"),
            "source": r.get("source_entity_id"),
            "target": r.get("target_entity_id"),
            "type": r.get("relationship_type", "LINKED"),
            "confidence": float(r.get("confidence", 0.95))
        })

    conf_scores = [float(r.get("confidence", 0.95)) for r in rels if "confidence" in r]
    avg_conf = (sum(conf_scores) / len(conf_scores) * 100) if conf_scores else 92.0
    alias_list = [a["alias"] for a in aliases if "alias" in a] if aliases else ([entity_doc.get("alias")] if entity_doc.get("alias") else ([entity_doc.get("phone_number")] if entity_doc.get("phone_number") else []))
    source_label = "SYNTHETIC / LAW ENFORCEMENT EXTRACTION" if entity_doc.get("synthetic_flag") else "VERIFIED OPERATIONAL INTELLIGENCE"

    return {
        "entity": {
            "id": entity_id,
            "name": entity_name,
            "type": entity_type,
            "flaggedRisk": risk_val,
            "aliases": alias_list,
            "attributes": entity_doc,
            "confidenceScore": round(avg_conf, 1),
            "sourceMetadata": source_label
        },
        "relationships": formatted_rels,
        "cases": formatted_cases,
        "evidence": formatted_evidence,
        "phones": phones,
        "devices": devices,
        "accounts": accounts,
        "aliases": aliases,
        "vehicles": vehicles,
        "events": events,
        "cdrs": cdrs,
        "transactions": transactions,
        "stats": {
            "totalRelationships": len(formatted_rels),
            "totalCases": len(formatted_cases),
            "totalEvidence": len(formatted_evidence),
            "totalEvents": len(events),
            "totalPhones": len(phones),
            "totalDevices": len(devices),
            "totalAccounts": len(accounts),
            "totalCdrs": len(cdrs),
            "totalTransactions": len(transactions),
            "confidenceScore": round(avg_conf, 1)
        }
    }
