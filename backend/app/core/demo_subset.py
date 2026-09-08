"""
SHERLOCK Demo Subset Builder

Builds a coherent relational subset of the full MongoDB dataset.
Starts from a stratified sample of persons (ensuring crime category coverage),
then expands outward to include all related entities, preserving referential integrity.

The subset is cached in memory as sets of IDs, and used by route handlers
to filter queries when DEMO_DATASET_ENABLED=true.
"""

from typing import Dict, Optional, Set
from app.core.config import settings

# ----- Cached demo ID sets -----
_demo_ids: Dict[str, Set[str]] = {}
_initialized: bool = False


def is_demo_enabled() -> bool:
    return settings.demo_dataset_enabled


async def initialize_demo_subset():
    """
    Called once during server startup (lifespan).
    Queries MongoDB to build coherent ID sets for the demo subset.
    """
    global _demo_ids, _initialized

    if not settings.demo_dataset_enabled:
        print("[SHERLOCK DEMO] Demo dataset DISABLED. Using full database.")
        _initialized = True
        return

    from app.db.mongodb import get_database
    db = get_database()
    if db is None:
        print("[SHERLOCK DEMO] Database not available. Skipping demo subset init.")
        _initialized = True
        return

    print(f"[SHERLOCK DEMO] Building coherent demo subset (person_limit={settings.demo_person_limit})...")
    person_limit = settings.demo_person_limit

    try:
        # =========================================================
        # STEP 1: Stratified person selection for crime coverage
        # =========================================================
        crime_types = await db.cases.distinct("crime_type")
        case_types = await db.cases.distinct("case_type")
        all_categories = [c for c in (crime_types + case_types) if c]
        print(f"[SHERLOCK DEMO]   Found {len(all_categories)} crime/case categories")

        selected_case_ids: Set[str] = set()
        cases_per_crime = max(2, person_limit // max(len(all_categories), 1) // 2)

        for ct in all_categories:
            cases_cursor = db.cases.find(
                {"$or": [{"crime_type": ct}, {"case_type": ct}]},
                {"case_id": 1, "_id": 0}
            ).limit(max(cases_per_crime, 5))
            ct_cases = await cases_cursor.to_list(length=max(cases_per_crime, 5))
            for c in ct_cases:
                if c.get("case_id"):
                    selected_case_ids.add(c["case_id"])

        # Ensure all cases in MongoDB are included in case selection
        async for c_doc in db.cases.find({}, {"case_id": 1, "_id": 0}):
            if c_doc.get("case_id"):
                selected_case_ids.add(c_doc["case_id"])

        print(f"[SHERLOCK DEMO]   Selected {len(selected_case_ids)} cases across categories")

        selected_person_ids: Set[str] = set()
        if selected_case_ids:
            case_id_list = list(selected_case_ids)

            ev_cursor = db.events.find(
                {"case_id": {"$in": case_id_list}, "person_id": {"$exists": True}},
                {"person_id": 1, "_id": 0}
            )
            async for ev in ev_cursor:
                pid = ev.get("person_id")
                if pid:
                    selected_person_ids.add(pid)

            evi_cursor = db.evidence.find(
                {"case_id": {"$in": case_id_list}},
                {"person_id": 1, "related_person_id": 1, "_id": 0}
            )
            async for evi in evi_cursor:
                for field in ("person_id", "related_person_id"):
                    pid = evi.get(field)
                    if pid:
                        selected_person_ids.add(pid)

        if len(selected_person_ids) < person_limit:
            remaining_needed = person_limit - len(selected_person_ids)
            exclude_list = list(selected_person_ids) if selected_person_ids else []

            pipeline = [
                {"$match": {"source_entity_id": {"$regex": "^PERSON"}}},
            ]
            if exclude_list:
                pipeline[0]["$match"]["source_entity_id"] = {
                    "$regex": "^PERSON",
                    "$nin": exclude_list
                }
            pipeline.extend([
                {"$group": {"_id": "$source_entity_id", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": remaining_needed}
            ])

            try:
                top_persons = await db.relationships.aggregate(pipeline).to_list(length=remaining_needed)
                for tp in top_persons:
                    if tp.get("_id"):
                        selected_person_ids.add(tp["_id"])
            except Exception:
                fallback_cursor = db.persons.find(
                    {"person_id": {"$nin": list(selected_person_ids)}} if selected_person_ids else {},
                    {"person_id": 1, "_id": 0}
                ).limit(remaining_needed)
                async for p in fallback_cursor:
                    if p.get("person_id"):
                        selected_person_ids.add(p["person_id"])

        if len(selected_person_ids) > person_limit:
            selected_person_ids = set(list(selected_person_ids)[:person_limit])

        print(f"[SHERLOCK DEMO]   Selected {len(selected_person_ids)} persons")

        # =========================================================
        # STEP 2: Expand outward from persons
        # =========================================================
        person_id_list = list(selected_person_ids)

        rel_ids: Set[str] = set()
        related_entity_ids: Set[str] = set()

        rel_cursor = db.relationships.find(
            {"$or": [
                {"source_entity_id": {"$in": person_id_list}},
                {"target_entity_id": {"$in": person_id_list}}
            ]},
            {"_id": 0}
        ).limit(5000)
        rels = await rel_cursor.to_list(length=5000)

        for r in rels:
            rid = r.get("relationship_id")
            src = r.get("source_entity_id")
            tgt = r.get("target_entity_id")
            if rid:
                rel_ids.add(rid)
            if src:
                related_entity_ids.add(src)
            if tgt:
                related_entity_ids.add(tgt)

        phone_ids: Set[str] = set()
        phone_cursor = db.phones.find({"person_id": {"$in": person_id_list}}, {"phone_id": 1, "_id": 0})
        async for ph in phone_cursor:
            if ph.get("phone_id"):
                phone_ids.add(ph["phone_id"])

        device_ids: Set[str] = set()
        device_cursor = db.devices.find({"person_id": {"$in": person_id_list}}, {"device_id": 1, "_id": 0})
        async for d in device_cursor:
            if d.get("device_id"):
                device_ids.add(d["device_id"])

        account_ids: Set[str] = set()
        acct_cursor = db.accounts.find({"person_id": {"$in": person_id_list}}, {"account_id": 1, "_id": 0})
        async for a in acct_cursor:
            if a.get("account_id"):
                account_ids.add(a["account_id"])

        alias_ids: Set[str] = set()
        alias_cursor = db.aliases.find({"person_id": {"$in": person_id_list}}, {"alias_id": 1, "_id": 0})
        async for al in alias_cursor:
            if al.get("alias_id"):
                alias_ids.add(al["alias_id"])

        vehicle_ids: Set[str] = set()
        veh_cursor = db.vehicles.find({"owner_person_id": {"$in": person_id_list}}, {"vehicle_id": 1, "_id": 0})
        async for v in veh_cursor:
            if v.get("vehicle_id"):
                vehicle_ids.add(v["vehicle_id"])

        for eid in related_entity_ids:
            if eid.startswith("PHONE"):
                phone_ids.add(eid)
            elif eid.startswith("ACCT"):
                account_ids.add(eid)
            elif eid.startswith("VEH"):
                vehicle_ids.add(eid)
            elif eid.startswith("DEVICE"):
                device_ids.add(eid)

        org_ids: Set[str] = set()
        for eid in related_entity_ids:
            if eid.startswith("ORG"):
                org_ids.add(eid)

        # Fallback to ensure demo subset has entities for accounts, phones, vehicles, orgs
        if len(phone_ids) < 50:
            async for ph in db.phones.find({}, {"phone_id": 1, "_id": 0}).limit(200):
                if ph.get("phone_id"):
                    phone_ids.add(ph["phone_id"])

        if len(account_ids) < 50:
            async for a in db.accounts.find({}, {"account_id": 1, "_id": 0}).limit(200):
                if a.get("account_id"):
                    account_ids.add(a["account_id"])

        if len(vehicle_ids) < 50:
            async for v in db.vehicles.find({}, {"vehicle_id": 1, "_id": 0}).limit(200):
                if v.get("vehicle_id"):
                    vehicle_ids.add(v["vehicle_id"])

        if len(org_ids) < 50:
            async for o in db.organizations.find({}, {"organization_id": 1, "_id": 0}).limit(200):
                if o.get("organization_id"):
                    org_ids.add(o["organization_id"])

        extra_events_cursor = db.events.find(
            {"person_id": {"$in": person_id_list}},
            {"case_id": 1, "_id": 0}
        )
        async for ev in extra_events_cursor:
            cid = ev.get("case_id")
            if cid:
                selected_case_ids.add(cid)

        extra_evi_cursor = db.evidence.find(
            {"$or": [
                {"person_id": {"$in": person_id_list}},
                {"related_person_id": {"$in": person_id_list}}
            ]},
            {"case_id": 1, "_id": 0}
        )
        async for evi in extra_evi_cursor:
            cid = evi.get("case_id")
            if cid:
                selected_case_ids.add(cid)

        cdr_ids: Set[str] = set()
        if phone_ids:
            phone_id_list = list(phone_ids)
            cdr_cursor = db.cdrs.find(
                {"$or": [
                    {"caller_phone_id": {"$in": phone_id_list}},
                    {"receiver_phone_id": {"$in": phone_id_list}}
                ]},
                {"cdr_id": 1, "_id": 0}
            ).limit(4000)
            async for cdr in cdr_cursor:
                if cdr.get("cdr_id"):
                    cdr_ids.add(cdr["cdr_id"])

        txn_ids: Set[str] = set()
        if account_ids:
            acct_id_list = list(account_ids)
            txn_cursor = db.transactions.find(
                {"$or": [
                    {"source_account_id": {"$in": acct_id_list}},
                    {"destination_account_id": {"$in": acct_id_list}}
                ]},
                {"transaction_id": 1, "_id": 0}
            ).limit(4000)
            async for txn in txn_cursor:
                if txn.get("transaction_id"):
                    txn_ids.add(txn["transaction_id"])

        event_ids: Set[str] = set()
        case_id_list = list(selected_case_ids)
        event_query = {"$or": []}
        if person_id_list:
            event_query["$or"].append({"person_id": {"$in": person_id_list}})
        if case_id_list:
            event_query["$or"].append({"case_id": {"$in": case_id_list}})

        if event_query["$or"]:
            event_cursor = db.events.find(event_query, {"event_id": 1, "_id": 0}).limit(2000)
            async for ev in event_cursor:
                if ev.get("event_id"):
                    event_ids.add(ev["event_id"])

        evidence_ids: Set[str] = set()
        evi_query = {"$or": []}
        if person_id_list:
            evi_query["$or"].append({"person_id": {"$in": person_id_list}})
            evi_query["$or"].append({"related_person_id": {"$in": person_id_list}})
        if case_id_list:
            evi_query["$or"].append({"case_id": {"$in": case_id_list}})

        if evi_query["$or"]:
            evi_cursor = db.evidence.find(evi_query, {"evidence_id": 1, "_id": 0}).limit(1500)
            async for evi in evi_cursor:
                if evi.get("evidence_id"):
                    evidence_ids.add(evi["evidence_id"])

        location_ids: Set[str] = set()
        for eid in related_entity_ids:
            if eid.startswith("LOC"):
                location_ids.add(eid)

        if event_ids:
            loc_event_cursor = db.events.find(
                {"event_id": {"$in": list(event_ids)}, "location_id": {"$exists": True}},
                {"location_id": 1, "_id": 0}
            )
            async for ev in loc_event_cursor:
                lid = ev.get("location_id")
                if lid:
                    location_ids.add(lid)

        # Apply maximum caps as requested
        _demo_ids["persons"] = selected_person_ids
        _demo_ids["cases"] = selected_case_ids
        _demo_ids["relationships"] = set(list(rel_ids)[:5000])
        _demo_ids["phones"] = set(list(phone_ids)[:800])
        _demo_ids["devices"] = set(list(device_ids)[:800])
        _demo_ids["accounts"] = set(list(account_ids)[:800])
        _demo_ids["aliases"] = set(list(alias_ids)[:250])
        _demo_ids["vehicles"] = set(list(vehicle_ids)[:600])
        _demo_ids["organizations"] = set(list(org_ids)[:150])
        _demo_ids["cdrs"] = set(list(cdr_ids)[:4000])
        _demo_ids["transactions"] = set(list(txn_ids)[:4000])
        _demo_ids["events"] = set(list(event_ids)[:2000])
        _demo_ids["evidence"] = set(list(evidence_ids)[:1500])
        _demo_ids["locations"] = set(list(location_ids)[:400])
        _demo_ids["all_entity_ids"] = (
            selected_person_ids | org_ids | phone_ids |
            account_ids | vehicle_ids | device_ids | location_ids
        )

        total = sum(len(v) for v in _demo_ids.values())
        print(f"[SHERLOCK DEMO] [SUCCESS] Demo subset ready. Total cached IDs: {total}")
        print(f"[SHERLOCK DEMO]   persons={len(_demo_ids['persons'])} cases={len(_demo_ids['cases'])} "
              f"relationships={len(_demo_ids['relationships'])} phones={len(_demo_ids['phones'])} devices={len(_demo_ids['devices'])} "
              f"accounts={len(_demo_ids['accounts'])} aliases={len(_demo_ids['aliases'])} vehicles={len(_demo_ids['vehicles'])} "
              f"orgs={len(_demo_ids['organizations'])} cdrs={len(_demo_ids['cdrs'])} txns={len(_demo_ids['transactions'])} events={len(_demo_ids['events'])} "
              f"evidence={len(_demo_ids['evidence'])} locations={len(_demo_ids['locations'])}")

    except Exception as e:
        print(f"[SHERLOCK DEMO WARNING] Could not build demo subset from MongoDB ({e}). Defaulting to un-filtered mode.")
    finally:
        _initialized = True


def get_demo_filter(collection: str, id_field: str) -> dict:
    """
    Returns a MongoDB query filter that restricts results to the demo subset.
    If demo is disabled or not initialized, returns empty dict (no filtering).
    """
    if not settings.demo_dataset_enabled or not _initialized:
        return {}

    ids = _demo_ids.get(collection)
    if ids is None or len(ids) == 0:
        return {}

    return {id_field: {"$in": list(ids)}}


def get_demo_id_set(collection: str) -> Optional[Set[str]]:
    """
    Returns the cached set of demo IDs for a collection.
    Returns None if demo is disabled.
    """
    if not settings.demo_dataset_enabled or not _initialized:
        return None
    return _demo_ids.get(collection)
