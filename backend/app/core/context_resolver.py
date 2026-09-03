import logging
from typing import Dict, List, Optional, Set, Tuple, Any
from app.db.mongodb import get_database
from app.core.demo_subset import is_demo_enabled, get_demo_filter, get_demo_id_set

logger = logging.getLogger("context_resolver")
logger.setLevel(logging.INFO)


class ResolvedContext:
    def __init__(self, requested_case_id: Optional[str] = None, requested_entity_id: Optional[str] = None):
        self.requested_case_id = requested_case_id
        self.requested_entity_id = requested_entity_id
        
        self.case_ids: Set[str] = set()
        if requested_case_id:
            self.case_ids.add(requested_case_id)
            
        self.entity_ids: Set[str] = set()
        if requested_entity_id:
            self.entity_ids.add(requested_entity_id)
            
        self.person_ids: Set[str] = set()
        self.org_ids: Set[str] = set()
        self.phone_ids: Set[str] = set()
        self.account_ids: Set[str] = set()
        self.vehicle_ids: Set[str] = set()
        self.device_ids: Set[str] = set()
        self.location_ids: Set[str] = set()
        
        self.evidence_ids: Set[str] = set()
        self.event_ids: Set[str] = set()
        self.relationship_ids: Set[str] = set()
        
        self.is_scoped = bool(requested_case_id or requested_entity_id)

    def to_dict(self) -> dict:
        return {
            "requested_case_id": self.requested_case_id,
            "requested_entity_id": self.requested_entity_id,
            "case_ids_count": len(self.case_ids),
            "total_entities_count": len(self.entity_ids),
            "person_ids_count": len(self.person_ids),
            "phone_ids_count": len(self.phone_ids),
            "account_ids_count": len(self.account_ids),
            "evidence_ids_count": len(self.evidence_ids),
            "event_ids_count": len(self.event_ids),
            "relationship_ids_count": len(self.relationship_ids)
        }


def _in_demo_set(collection: str, item_id: str) -> bool:
    if not item_id:
        return False
    s = get_demo_id_set(collection)
    if s is None:
        return True
    return item_id in s

def _filter_by_demo(entity_id: str, demo_enabled: bool) -> bool:
    if not demo_enabled:
        return True
    if not entity_id:
        return False
    u = entity_id.upper()
    if u.startswith("PERSON"):
        return _in_demo_set("persons", entity_id)
    if u.startswith("PHONE"):
        return _in_demo_set("phones", entity_id)
    if u.startswith("ACCT"):
        return _in_demo_set("accounts", entity_id)
    if u.startswith("VEH"):
        return _in_demo_set("vehicles", entity_id)
    if u.startswith("DEVICE"):
        return _in_demo_set("devices", entity_id)
    if u.startswith("ORG"):
        return _in_demo_set("organizations", entity_id)
    if u.startswith("CASE"):
        return _in_demo_set("cases", entity_id)
    if u.startswith("LOC"):
        return _in_demo_set("locations", entity_id)
    return True


async def resolve_context(case_id: Optional[str] = None, entity_id: Optional[str] = None) -> ResolvedContext:
    ctx = ResolvedContext(requested_case_id=case_id, requested_entity_id=entity_id)
    if not ctx.is_scoped:
        return ctx

    db = get_database()
    if db is None:
        return ctx

    demo_on = is_demo_enabled()

    # Helper to add entity with demo filtering
    def add_entity(eid: str):
        if not eid:
            return
        if demo_on and not _filter_by_demo(eid, demo_on):
            return
        ctx.entity_ids.add(eid)
        u = eid.upper()
        if u.startswith("PERSON"): ctx.person_ids.add(eid)
        elif u.startswith("ORG"): ctx.org_ids.add(eid)
        elif u.startswith("PHONE"): ctx.phone_ids.add(eid)
        elif u.startswith("ACCT"): ctx.account_ids.add(eid)
        elif u.startswith("VEH"): ctx.vehicle_ids.add(eid)
        elif u.startswith("DEVICE"): ctx.device_ids.add(eid)
        elif u.startswith("LOC"): ctx.location_ids.add(eid)

    # Step 1: Case primary entity resolution
    if case_id:
        c_doc = await db.cases.find_one({"$or": [{"case_id": case_id}, {"_id": case_id}]}, {"_id": 0})
        if c_doc:
            for field in ["person_id", "suspect_id", "victim_id", "entity_id", "owner_person_id"]:
                val = c_doc.get(field)
                if val:
                    add_entity(val)

    if entity_id:
        add_entity(entity_id)

    # Step 2: Traverse Relationships
    rel_or_list = []
    if case_id:
        rel_or_list.append({"case_id": case_id})
    if ctx.entity_ids:
        entity_list = list(ctx.entity_ids)
        rel_or_list.append({"source_entity_id": {"$in": entity_list}})
        rel_or_list.append({"target_entity_id": {"$in": entity_list}})

    if rel_or_list:
        rel_query = {"$or": rel_or_list}
        if demo_on:
            rel_query = {"$and": [rel_query, get_demo_filter("relationships", "relationship_id")]}

        rels = await db.relationships.find(rel_query, {"_id": 0}).to_list(length=500)
        for r in rels:
            rid = r.get("relationship_id")
            if rid:
                if not demo_on or _in_demo_set("relationships", rid):
                    ctx.relationship_ids.add(rid)
            if r.get("case_id"):
                if not demo_on or _in_demo_set("cases", r["case_id"]):
                    ctx.case_ids.add(r["case_id"])
            if r.get("evidence_id"):
                if not demo_on or _in_demo_set("evidence", r["evidence_id"]):
                    ctx.evidence_ids.add(r["evidence_id"])
            for f in ("source_entity_id", "target_entity_id"):
                v = r.get(f)
                if v:
                    add_entity(v)

    # Step 3: Traverse Evidence
    evi_or_list = []
    if case_id:
        evi_or_list.append({"case_id": case_id})
    if ctx.entity_ids:
        entity_list = list(ctx.entity_ids)
        evi_or_list.append({"person_id": {"$in": entity_list}})
        evi_or_list.append({"related_person_id": {"$in": entity_list}})
        evi_or_list.append({"related_vehicle_id": {"$in": entity_list}})
        evi_or_list.append({"related_device_id": {"$in": entity_list}})

    if evi_or_list:
        evi_query = {"$or": evi_or_list}
        if demo_on:
            evi_query = {"$and": [evi_query, get_demo_filter("evidence", "evidence_id")]}

        evis = await db.evidence.find(evi_query, {"_id": 0}).to_list(length=300)
        for ev in evis:
            eid = ev.get("evidence_id")
            if eid:
                if not demo_on or _in_demo_set("evidence", eid):
                    ctx.evidence_ids.add(eid)
            if ev.get("case_id"):
                if not demo_on or _in_demo_set("cases", ev["case_id"]):
                    ctx.case_ids.add(ev["case_id"])
            for f in ("person_id", "related_person_id"):
                pid = ev.get(f)
                if pid:
                    add_entity(pid)

    # Step 4: Traverse Events
    evt_or_list = []
    if case_id:
        evt_or_list.append({"case_id": case_id})
    if ctx.entity_ids:
        entity_list = list(ctx.entity_ids)
        evt_or_list.append({"person_id": {"$in": entity_list}})
        evt_or_list.append({"phone_id": {"$in": entity_list}})
        evt_or_list.append({"vehicle_id": {"$in": entity_list}})

    if evt_or_list:
        evt_query = {"$or": evt_or_list}
        if demo_on:
            evt_query = {"$and": [evt_query, get_demo_filter("events", "event_id")]}

        evts = await db.events.find(evt_query, {"_id": 0}).to_list(length=300)
        for e in evts:
            ev_id = e.get("event_id")
            if ev_id:
                if not demo_on or _in_demo_set("events", ev_id):
                    ctx.event_ids.add(ev_id)
            if e.get("case_id"):
                if not demo_on or _in_demo_set("cases", e["case_id"]):
                    ctx.case_ids.add(e["case_id"])
            if e.get("evidence_id"):
                if not demo_on or _in_demo_set("evidence", e["evidence_id"]):
                    ctx.evidence_ids.add(e["evidence_id"])
            for f in ("person_id", "phone_id", "vehicle_id", "location_id"):
                v = e.get(f)
                if v:
                    add_entity(v)

    # Step 5: Query asset mappings for resolved person IDs
    if ctx.person_ids:
        pids = list(ctx.person_ids)
        
        ph_q = {"person_id": {"$in": pids}}
        if demo_on: ph_q = {"$and": [ph_q, get_demo_filter("phones", "phone_id")]}
        phones = await db.phones.find(ph_q, {"phone_id": 1, "_id": 0}).to_list(length=200)
        for p in phones:
            if p.get("phone_id"): add_entity(p["phone_id"])

        acc_q = {"person_id": {"$in": pids}}
        if demo_on: acc_q = {"$and": [acc_q, get_demo_filter("accounts", "account_id")]}
        accounts = await db.accounts.find(acc_q, {"account_id": 1, "_id": 0}).to_list(length=200)
        for a in accounts:
            if a.get("account_id"): add_entity(a["account_id"])

        veh_q = {"owner_person_id": {"$in": pids}}
        if demo_on: veh_q = {"$and": [veh_q, get_demo_filter("vehicles", "vehicle_id")]}
        vehicles = await db.vehicles.find(veh_q, {"vehicle_id": 1, "_id": 0}).to_list(length=200)
        for v in vehicles:
            if v.get("vehicle_id"): add_entity(v["vehicle_id"])

        dev_q = {"person_id": {"$in": pids}}
        if demo_on: dev_q = {"$and": [dev_q, get_demo_filter("devices", "device_id")]}
        devices = await db.devices.find(dev_q, {"device_id": 1, "_id": 0}).to_list(length=200)
        for d in devices:
            if d.get("device_id"): add_entity(d["device_id"])

    # Step 6: Hop 2 Relationship expansion for connected asset entities
    if ctx.entity_ids:
        all_e_list = list(ctx.entity_ids)
        hop2_q = {
            "$or": [
                {"source_entity_id": {"$in": all_e_list}},
                {"target_entity_id": {"$in": all_e_list}}
            ]
        }
        if demo_on: hop2_q = {"$and": [hop2_q, get_demo_filter("relationships", "relationship_id")]}
        hop2_rels = await db.relationships.find(hop2_q, {"_id": 0}).to_list(length=500)

        for r in hop2_rels:
            rid = r.get("relationship_id")
            if rid and (not demo_on or _in_demo_set("relationships", rid)):
                ctx.relationship_ids.add(rid)
            for f in ("source_entity_id", "target_entity_id"):
                v = r.get(f)
                if v: add_entity(v)

    logger.info(f"[CONTEXT RESOLVER] Resolved scope for case_id='{case_id}', entity_id='{entity_id}': {ctx.to_dict()}")
    return ctx


# Helper Feature Query Functions

async def get_scoped_cdrs(case_id: Optional[str] = None, phone_id: Optional[str] = None, limit: int = 100, skip: int = 0) -> List[dict]:
    db = get_database()
    if db is None:
        return []

    demo_on = is_demo_enabled()
    ctx = await resolve_context(case_id=case_id, entity_id=phone_id)

    if ctx.is_scoped:
        query_list = []
        if phone_id:
            query_list.append({"caller_phone_id": phone_id})
            query_list.append({"receiver_phone_id": phone_id})
            query_list.append({"caller_phone": phone_id})
            query_list.append({"receiver_phone": phone_id})

        if case_id:
            for cid in ctx.case_ids:
                query_list.append({"case_id": cid})
                query_list.append({"linked_case_id": cid})

        if ctx.phone_ids:
            phone_list = list(ctx.phone_ids)
            query_list.append({"caller_phone_id": {"$in": phone_list}})
            query_list.append({"receiver_phone_id": {"$in": phone_list}})
            query_list.append({"caller_phone": {"$in": phone_list}})
            query_list.append({"receiver_phone": {"$in": phone_list}})

        if not query_list:
            logger.info(f"[CONTEXT SAFEGUARD] case_id='{case_id}' has no linked phone records. Returning [].")
            return []

        base_query = {"$or": query_list}
        if demo_on:
            query = {"$and": [base_query, get_demo_filter("cdrs", "cdr_id")]}
        else:
            query = base_query
    else:
        # Un-scoped mode (No case selected): return demo dataset or full DB
        query = get_demo_filter("cdrs", "cdr_id") if demo_on else {}

    cursor = db.cdrs.find(query, {"_id": 0}).skip(skip).limit(limit)
    raw = await cursor.to_list(length=limit)
    logger.info(f"[CONTEXT SAFEGUARD] get_scoped_cdrs(case_id='{case_id}') -> returned {len(raw)} records.")
    return raw


async def get_scoped_transactions(case_id: Optional[str] = None, account_id: Optional[str] = None, limit: int = 100, skip: int = 0) -> List[dict]:
    db = get_database()
    if db is None:
        return []

    demo_on = is_demo_enabled()
    ctx = await resolve_context(case_id=case_id, entity_id=account_id)

    if ctx.is_scoped:
        query_list = []
        if account_id:
            query_list.append({"source_account_id": account_id})
            query_list.append({"destination_account_id": account_id})

        if case_id:
            for cid in ctx.case_ids:
                query_list.append({"case_id": cid})
                query_list.append({"linked_case_id": cid})

        if ctx.account_ids:
            acct_list = list(ctx.account_ids)
            query_list.append({"source_account_id": {"$in": acct_list}})
            query_list.append({"destination_account_id": {"$in": acct_list}})

        if not query_list:
            logger.info(f"[CONTEXT SAFEGUARD] case_id='{case_id}' has no linked transaction records. Returning [].")
            return []

        base_query = {"$or": query_list}
        if demo_on:
            query = {"$and": [base_query, get_demo_filter("transactions", "transaction_id")]}
        else:
            query = base_query
    else:
        query = get_demo_filter("transactions", "transaction_id") if demo_on else {}

    cursor = db.transactions.find(query, {"_id": 0}).skip(skip).limit(limit)
    raw = await cursor.to_list(length=limit)
    logger.info(f"[CONTEXT SAFEGUARD] get_scoped_transactions(case_id='{case_id}') -> returned {len(raw)} records.")
    return raw


async def get_scoped_events(case_id: Optional[str] = None, entity_id: Optional[str] = None, limit: int = 100, skip: int = 0) -> List[dict]:
    db = get_database()
    if db is None:
        return []

    demo_on = is_demo_enabled()
    ctx = await resolve_context(case_id=case_id, entity_id=entity_id)

    if ctx.is_scoped:
        query_list = []
        if case_id:
            for cid in ctx.case_ids:
                query_list.append({"case_id": cid})

        if ctx.event_ids:
            query_list.append({"event_id": {"$in": list(ctx.event_ids)}})

        if ctx.entity_ids:
            e_list = list(ctx.entity_ids)
            query_list.append({"person_id": {"$in": e_list}})
            query_list.append({"phone_id": {"$in": e_list}})
            query_list.append({"vehicle_id": {"$in": e_list}})

        if not query_list:
            logger.info(f"[CONTEXT SAFEGUARD] case_id='{case_id}' has no linked timeline events. Returning [].")
            return []

        base_query = {"$or": query_list}
        if demo_on:
            query = {"$and": [base_query, get_demo_filter("events", "event_id")]}
        else:
            query = base_query
    else:
        query = get_demo_filter("events", "event_id") if demo_on else {}

    cursor = db.events.find(query, {"_id": 0}).sort("timestamp", 1).skip(skip).limit(limit)
    raw = await cursor.to_list(length=limit)
    logger.info(f"[CONTEXT SAFEGUARD] get_scoped_events(case_id='{case_id}') -> returned {len(raw)} records.")
    return raw


async def get_scoped_evidence(case_id: Optional[str] = None, evidence_type: Optional[str] = None, limit: int = 100, skip: int = 0) -> List[dict]:
    db = get_database()
    if db is None:
        return []

    demo_on = is_demo_enabled()
    ctx = await resolve_context(case_id=case_id)

    if ctx.is_scoped:
        query_list = []
        if case_id:
            for cid in ctx.case_ids:
                query_list.append({"case_id": cid})

        if ctx.evidence_ids:
            query_list.append({"evidence_id": {"$in": list(ctx.evidence_ids)}})

        if ctx.person_ids:
            p_list = list(ctx.person_ids)
            query_list.append({"person_id": {"$in": p_list}})
            query_list.append({"related_person_id": {"$in": p_list}})

        if not query_list:
            logger.info(f"[CONTEXT SAFEGUARD] case_id='{case_id}' has no linked evidence records. Returning [].")
            return []

        base_query = {"$or": query_list}
        if demo_on:
            base_query = {"$and": [base_query, get_demo_filter("evidence", "evidence_id")]}
    else:
        base_query = get_demo_filter("evidence", "evidence_id") if demo_on else {}

    if evidence_type and evidence_type != "ALL":
        if base_query:
            query = {"$and": [base_query, {"evidence_type": evidence_type}]}
        else:
            query = {"evidence_type": evidence_type}
    else:
        query = base_query

    cursor = db.evidence.find(query, {"_id": 0}).skip(skip).limit(limit)
    raw = await cursor.to_list(length=limit)
    logger.info(f"[CONTEXT SAFEGUARD] get_scoped_evidence(case_id='{case_id}') -> returned {len(raw)} records.")
    return raw


async def get_scoped_relationships(case_id: Optional[str] = None, entity_id: Optional[str] = None, limit: int = 100, skip: int = 0) -> List[dict]:
    db = get_database()
    if db is None:
        return []

    demo_on = is_demo_enabled()
    ctx = await resolve_context(case_id=case_id, entity_id=entity_id)

    if ctx.is_scoped:
        query_list = []
        if case_id:
            for cid in ctx.case_ids:
                query_list.append({"case_id": cid})

        if ctx.relationship_ids:
            query_list.append({"relationship_id": {"$in": list(ctx.relationship_ids)}})

        if ctx.entity_ids:
            e_list = list(ctx.entity_ids)
            query_list.append({"source_entity_id": {"$in": e_list}})
            query_list.append({"target_entity_id": {"$in": e_list}})

        if not query_list:
            logger.info(f"[CONTEXT SAFEGUARD] case_id='{case_id}' has no linked relationships. Returning [].")
            return []

        base_query = {"$or": query_list}
        if demo_on:
            query = {"$and": [base_query, get_demo_filter("relationships", "relationship_id")]}
        else:
            query = base_query
    else:
        query = get_demo_filter("relationships", "relationship_id") if demo_on else {}

    cursor = db.relationships.find(query, {"_id": 0}).skip(skip).limit(limit)
    raw = await cursor.to_list(length=limit)
    logger.info(f"[CONTEXT SAFEGUARD] get_scoped_relationships(case_id='{case_id}') -> returned {len(raw)} records.")
    return raw


async def get_scoped_anomalies(case_id: Optional[str] = None, category: Optional[str] = None, severity: Optional[str] = None, limit: int = 200) -> List[dict]:
    db = get_database()
    if db is None:
        return []

    anomalies = []

    # 1. Telecom Anomalies (CDRs)
    if not category or category.upper() in ["ALL", "TELECOM"]:
        cdrs = await get_scoped_cdrs(case_id=case_id, limit=100)
        for c in cdrs:
            dur = int(float(c.get("duration_seconds", 0) or 0))
            ts = str(c.get("timestamp", ""))
            call_type = str(c.get("call_type", "VOICE")).upper()
            is_night = any(f"T0{h}:" in ts for h in range(0, 5))
            if is_night or call_type in ["ENCRYPTED", "VOIP"] or dur > 600 or c.get("flagged_anomaly"):
                caller = c.get("caller_phone_id") or c.get("caller_phone")
                receiver = c.get("receiver_phone_id") or c.get("receiver_phone")
                entities = [e for e in [caller, receiver] if e]
                sev = "CRITICAL" if (is_night and call_type in ["ENCRYPTED", "VOIP"]) else ("HIGH" if is_night else "MEDIUM")
                anomalies.append({
                    "id": f"ANOM-{c.get('cdr_id', 'CDR')}",
                    "category": "TELECOM",
                    "severity": sev,
                    "title": f"Nighttime {call_type} Telecom Burst",
                    "description": f"Call registered between line {caller or 'Unknown'} and {receiver or 'Unknown'} at cell tower {c.get('cell_tower_id', 'TOWER-01')}. Duration: {dur}s.",
                    "recommendedAction": "Issue Section 91 CrPC notice for carrier tower dump & IMEI correlation.",
                    "entities": entities,
                    "caseId": c.get("case_id") or c.get("linked_case_id") or case_id,
                    "detectedAt": ts
                })

    # 2. Financial Anomalies (Transactions)
    if not category or category.upper() in ["ALL", "FINANCIAL"]:
        txns = await get_scoped_transactions(case_id=case_id, limit=100)
        for t in txns:
            amt = float(t.get("amount", 0) or 0)
            ttype = str(t.get("transaction_type", "TRANSFER")).upper()
            src = t.get("source_account_id")
            dst = t.get("destination_account_id")
            entities = [e for e in [src, dst] if e]
            sev = "CRITICAL" if amt >= 50000 else ("HIGH" if amt >= 20000 else "MEDIUM")
            anomalies.append({
                "id": f"ANOM-{t.get('transaction_id', 'TXN')}",
                "category": "FINANCIAL",
                "severity": sev,
                "title": f"Rapid {ttype} Escrow Structuring",
                "description": f"Transaction of ₹{amt:,.2f} processed from account {src or 'Unknown'} to target {dst or 'Unknown'}. Ref: {t.get('reference', 'SYNREF')}.",
                "recommendedAction": "Apply immediate freeze order on recipient account & obtain SWIFT MT103 slips.",
                "entities": entities,
                "caseId": t.get("case_id") or case_id,
                "detectedAt": t.get("timestamp")
            })

    # 3. Behavioral / Relationship Anomalies
    if not category or category.upper() in ["ALL", "BEHAVIORAL"]:
        rels = await get_scoped_relationships(case_id=case_id, limit=80)
        for r in rels:
            src = r.get("source_entity_id")
            tgt = r.get("target_entity_id")
            rtype = str(r.get("relationship_type", "LINKED")).upper()
            conf = float(r.get("confidence", 0.9) or 0.9)
            if src and tgt:
                anomalies.append({
                    "id": f"ANOM-{r.get('relationship_id', 'REL')}",
                    "category": "BEHAVIORAL",
                    "severity": "HIGH" if conf >= 0.9 else "MEDIUM",
                    "title": f"High-Centrality {rtype} Linkage",
                    "description": f"Identified direct relationship ({rtype}) between target node {src} and target node {tgt} with confidence {conf:.2f}.",
                    "recommendedAction": "Conduct cross-examination of registered identity documents & KYC records.",
                    "entities": [src, tgt],
                    "caseId": r.get("case_id") or case_id,
                    "detectedAt": r.get("start_time") or "2023-01-07T00:00:00"
                })

    # 4. Geographic Anomalies (Events)
    if not category or category.upper() in ["ALL", "GEOGRAPHIC"]:
        events = await get_scoped_events(case_id=case_id, limit=80)
        for ev in events:
            pid = ev.get("person_id")
            vid = ev.get("vehicle_id")
            loc = ev.get("location_id", "LOC-001")
            etype = str(ev.get("event_type", "SIGHTING")).upper()
            entities = [e for e in [pid, vid] if e]
            anomalies.append({
                "id": f"ANOM-{ev.get('event_id', 'EVT')}",
                "category": "GEOGRAPHIC",
                "severity": "HIGH" if pid else "MEDIUM",
                "title": f"Synchronous {etype} Sighting",
                "description": f"Location event registered at {loc} involving target {pid or 'Unknown'} and vehicle {vid or 'N/A'}.",
                "recommendedAction": "Audit local CCTV footage & ANPR toll camera logs for verification.",
                "entities": entities,
                "caseId": ev.get("case_id") or case_id,
                "detectedAt": ev.get("timestamp")
            })

    if severity and severity.upper() != "ALL":
        req_sev = severity.upper()
        anomalies = [a for a in anomalies if a.get("severity") == req_sev]

    if category and category.upper() != "ALL":
        req_cat = category.upper()
        anomalies = [a for a in anomalies if a.get("category") == req_cat]

    logger.info(f"[CONTEXT SAFEGUARD] get_scoped_anomalies(case_id='{case_id}') -> returned {len(anomalies)} anomalies.")
    return anomalies[:limit]
