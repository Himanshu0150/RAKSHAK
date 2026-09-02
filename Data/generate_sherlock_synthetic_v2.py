from pathlib import Path
import csv
import json
import random
import hashlib
from collections import defaultdict, Counter
from datetime import datetime, timedelta

# ============================================================
# SHERLOCK Synthetic Investigation Dataset Generator V2
# ============================================================
# Purpose:
#   Generate a fully interconnected synthetic investigation dataset
#   for SHERLOCK SIH demonstrations, graph analytics and validation.
#
# Design:
#   - NCRB aggregate statistics remain the statistical foundation.
#   - Every individual investigative record generated here is synthetic.
#   - Criminal networks are generated first; records are then projected
#     into cases, communications, finances, assets and evidence.
#   - Ground truth is isolated from operational data.
#
# Default output:
#   E:\SIH\Data\SYNTHETIC
#   E:\SIH\Data\GROUND_TRUTH
#
# Run:
#   python generate_sherlock_synthetic_v2.py
#
# Optional:
#   python generate_sherlock_synthetic_v2.py --seed 20260901
#   python generate_sherlock_synthetic_v2.py --cases 1000 --persons 3000
# ============================================================

import argparse
import math
import shutil
import sys


# -----------------------------
# Configuration
# -----------------------------
DEFAULT_BASE = Path(r"E:\SIH\Data")
DEFAULT_SEED = 20260901

CRIMES = [
    ("MURDER", "Violent Crime", "CRITICAL"),
    ("ATTEMPTED_MURDER", "Violent Crime", "CRITICAL"),
    ("CULPABLE_HOMICIDE", "Violent Crime", "CRITICAL"),
    ("RAPE", "Sexual Crime", "CRITICAL"),
    ("ATTEMPTED_RAPE", "Sexual Crime", "CRITICAL"),
    ("KIDNAPPING", "Kidnapping/Abduction", "CRITICAL"),
    ("KIDNAPPING_FOR_RANSOM", "Kidnapping/Abduction", "CRITICAL"),
    ("HUMAN_TRAFFICKING", "Trafficking", "CRITICAL"),
    ("CHILD_RELATED_CRIME", "Crime Against Children", "CRITICAL"),
    ("CRUELTY_BY_HUSBAND_OR_RELATIVES", "Crime Against Women", "HIGH"),
    ("NARCOTICS_NDPS", "Narcotics", "HIGH"),
    ("NARCOTICS_TRAFFICKING", "Narcotics", "CRITICAL"),
    ("ROBBERY", "Property/Violent Crime", "HIGH"),
    ("DACOITY", "Property/Violent Crime", "CRITICAL"),
    ("THEFT", "Property Crime", "MEDIUM"),
    ("BURGLARY", "Property Crime", "MEDIUM"),
    ("VEHICLE_THEFT", "Property Crime", "MEDIUM"),
    ("EXTORTION", "Organized/Financial Crime", "HIGH"),
    ("ASSAULT", "Violent Crime", "HIGH"),
    ("FINANCIAL_FRAUD", "Financial Crime", "HIGH"),
    ("CYBERCRIME", "Cybercrime", "HIGH"),
    ("FORGERY", "Financial Crime", "MEDIUM"),
    ("OTHER_SPECIAL_LOCAL_LAWS", "Special/Local Law", "MEDIUM"),
]

STATES = [
    "Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Uttar Pradesh",
    "Gujarat", "Rajasthan", "West Bengal", "Telangana", "Kerala"
]

FIRST = [
    "Aarav", "Vihaan", "Aditya", "Kabir", "Arjun", "Rohan", "Ishaan",
    "Neel", "Anaya", "Diya", "Meera", "Ira", "Riya", "Kavya",
    "Raj", "Vikram", "Nikhil", "Sana", "Aisha", "Priya", "Maya",
    "Karan", "Manav", "Rahul", "Simran", "Tara"
]

LAST = [
    "Sharma", "Patel", "Verma", "Singh", "Khan", "Mehta", "Rao", "Das",
    "Joshi", "Nair", "Gupta", "Iyer", "Yadav", "Kulkarni", "Deshmukh",
    "Chauhan", "Malik", "Pawar"
]

OCCUPATIONS = [
    "Employee", "Business", "Student", "Driver", "Contractor",
    "Trader", "Technician", "Consultant", "Transport Operator",
    "Freelancer", "Shopkeeper"
]

REL_TYPES = [
    "KNOWS", "ASSOCIATED_WITH", "WORKS_WITH", "FAMILY_LINK",
    "FINANCIAL_LINK", "COMMUNICATION_LINK", "LOCATED_AT",
    "USES", "OWNS", "SUSPECT_IN", "OBSERVED_IN", "MEMBER_OF",
    "CONTROLS", "TRANSACTED_WITH", "TRAVELLED_WITH"
]

NETWORK_ARCHETYPES = [
    "ORGANIZED_CRIME",
    "NARCOTICS",
    "HUMAN_TRAFFICKING",
    "FINANCIAL_FRAUD",
    "CYBERCRIME",
    "ROBBERY_DACOITY",
    "KIDNAPPING",
    "MIXED_CRIME",
]

BANKS = ["Synthetic Bank A", "Synthetic Bank B", "Synthetic Bank C",
         "Synthetic Cooperative Bank", "Synthetic Digital Bank"]

ORG_TYPES = [
    "Front Company", "Transport Company", "Trading Company",
    "Construction Firm", "Logistics Company", "Digital Services Firm",
    "Hospitality Business", "Shell-like Synthetic Entity", "Legitimate Business"
]

VEHICLE_TYPES = ["Car", "SUV", "Motorcycle", "Van", "Truck", "Auto"]

VEHICLE_MAKES = [
    ("Tata", ["Nexon", "Punch", "Altroz"]),
    ("Mahindra", ["Bolero", "Scorpio", "XUV"]),
    ("Maruti", ["Swift", "Baleno", "Ertiga"]),
    ("Hyundai", ["i20", "Creta", "Venue"]),
    ("Toyota", ["Innova", "Urban Cruiser"]),
]

ALIAS_TYPES = ["Nickname", "Operational Alias", "Online Handle",
               "Business Name", "Known As"]

TRANSACTION_TYPES = [
    "TRANSFER", "CASH_DEPOSIT", "CASH_WITHDRAWAL",
    "MERCHANT_PAYMENT", "BILL_PAYMENT", "REFUND"
]


def rid(prefix, n):
    return f"{prefix}-{n:06d}"


def safe_int(v):
    try:
        return int(v)
    except Exception:
        return 0


def weighted_choice(items):
    return random.choice(items)


def iso(dt):
    return dt.isoformat(timespec="seconds")


def write_csv(folder, name, rows, field_order=None):
    path = folder / f"{name}.csv"
    if field_order is None:
        field_order = list(rows[0].keys()) if rows else []
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=field_order)
        w.writeheader()
        if rows:
            w.writerows(rows)
    return path


def hash_row(row):
    payload = json.dumps(row, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


class Generator:
    def __init__(self, base, seed, n_cases, n_persons):
        self.base = Path(base)
        self.syn = self.base / "SYNTHETIC"
        self.truth = self.base / "GROUND_TRUTH"
        self.seed = seed
        self.n_cases = n_cases
        self.n_persons = n_persons

        random.seed(seed)

        for folder in (self.syn, self.truth):
            folder.mkdir(parents=True, exist_ok=True)

        self.counters = defaultdict(int)
        self.data = defaultdict(list)
        self.truth_data = defaultdict(list)

        self.person_by_id = {}
        self.phone_by_id = {}
        self.account_by_id = {}
        self.vehicle_by_id = {}
        self.case_by_id = {}
        self.location_by_id = {}
        self.org_by_id = {}

        self.person_phones = defaultdict(list)
        self.person_accounts = defaultdict(list)
        self.person_vehicles = defaultdict(list)
        self.person_cases = defaultdict(set)
        self.network_members = defaultdict(set)
        self.case_networks = defaultdict(set)

    def new_id(self, prefix):
        self.counters[prefix] += 1
        return rid(prefix, self.counters[prefix])

    def make_person(self, pid, state=None, role="associate"):
        state = state or random.choice(STATES)
        gender = random.choice(["Female", "Male"])
        p = {
            "person_id": pid,
            "name": f"{random.choice(FIRST)} {random.choice(LAST)}",
            "age": random.randint(18, 65),
            "gender": gender,
            "role": role,
            "occupation": random.choice(OCCUPATIONS),
            "state": state,
            "district": f"District-{random.randint(1,40):02d}",
            "synthetic_flag": "true",
        }
        self.data["persons"].append(p)
        self.person_by_id[pid] = p
        return p

    def make_location(self, state, district=None):
        lid = self.new_id("LOC")
        loc = {
            "location_id": lid,
            "location_type": random.choice(
                ["Residence", "Road", "Commercial", "Public", "Transit",
                 "Warehouse", "Office", "Hotel", "Financial", "Digital"]
            ),
            "state": state,
            "district": district or f"District-{random.randint(1,40):02d}",
            "city": f"City-{random.randint(1,30):02d}",
            "area": f"Area-{random.randint(1,150):03d}",
            "latitude": round(random.uniform(8, 34), 6),
            "longitude": round(random.uniform(68, 97), 6),
            "address_label": f"Synthetic Location {self.counters['LOC']}",
            "synthetic_flag": "true",
        }
        self.data["locations"].append(loc)
        self.location_by_id[lid] = loc
        return lid

    def make_phone(self, person_id, first_seen):
        phid = self.new_id("PHONE")
        did = self.new_id("DEVICE")
        phone = {
            "phone_id": phid,
            "phone_number": f"+91-SYN-{self.counters['PHONE']:08d}",
            "person_id": person_id,
            "device_id": did,
            "carrier": "SyntheticTel",
            "activation_date": "2023-01-01",
            "status": random.choice(["Active", "Active", "Inactive"]),
            "synthetic_flag": "true",
        }
        device = {
            "device_id": did,
            "device_type": random.choice(["Smartphone", "Feature Phone", "Tablet"]),
            "person_id": person_id,
            "os": random.choice(["Android", "iOS"]),
            "first_seen": first_seen.date().isoformat(),
            "last_seen": first_seen.date().isoformat(),
            "synthetic_flag": "true",
        }
        self.data["phones"].append(phone)
        self.data["devices"].append(device)
        self.phone_by_id[phid] = phone
        self.person_phones[person_id].append(phid)
        return phid

    def make_vehicle(self, person_id, state):
        vid = self.new_id("VEH")
        make, models = random.choice(VEHICLE_MAKES)
        vehicle = {
            "vehicle_id": vid,
            "vehicle_type": random.choice(VEHICLE_TYPES),
            "registration_alias": f"SYN-{state[:2].upper()}-{self.counters['VEH']:05d}",
            "owner_person_id": person_id,
            "color": random.choice(["White", "Black", "Silver", "Blue", "Grey", "Red"]),
            "make": make,
            "model": random.choice(models),
            "status": random.choice(["Active", "Active", "Transferred"]),
            "synthetic_flag": "true",
        }
        self.data["vehicles"].append(vehicle)
        self.vehicle_by_id[vid] = vehicle
        self.person_vehicles[person_id].append(vid)
        return vid

    def make_account(self, person_id, opened):
        aid = self.new_id("ACCT")
        account = {
            "account_id": aid,
            "person_id": person_id,
            "institution_type": random.choice(BANKS),
            "account_type": random.choice(["Savings", "Current", "Digital Wallet"]),
            "masked_identifier": f"SYN-XXXX-{self.counters['ACCT']:04d}",
            "opened_date": opened.date().isoformat(),
            "status": random.choice(["Active", "Active", "Dormant"]),
            "synthetic_flag": "true",
        }
        self.data["accounts"].append(account)
        self.account_by_id[aid] = account
        self.person_accounts[person_id].append(aid)
        return aid

    def make_org(self, state, location_id, network_type):
        oid = self.new_id("ORG")
        name_parts = [
            "Aster", "Blue", "Cedar", "Delta", "Everest", "Falcon",
            "Harbor", "Indigo", "Lotus", "Northstar", "Orion", "Pioneer"
        ]
        org = {
            "organization_id": oid,
            "name": f"{random.choice(name_parts)} {random.choice(['Logistics','Trading','Services','Enterprises','Solutions','Transport'])} {self.counters['ORG']:03d}",
            "organization_type": random.choice(ORG_TYPES),
            "location_id": location_id,
            "network_type": network_type,
            "status": random.choice(["Active", "Active", "Inactive"]),
            "synthetic_flag": "true",
        }
        self.data["organizations"].append(org)
        self.org_by_id[oid] = org
        return oid

    def add_rel(self, source_type, source_id, rel_type, target_type, target_id,
                 timestamp="", confidence=1.0, case_id="", evidence_id=""):
        rid_ = self.new_id("REL")
        self.data["relationships"].append({
            "relationship_id": rid_,
            "source_entity_type": source_type,
            "source_entity_id": source_id,
            "relationship_type": rel_type,
            "target_entity_type": target_type,
            "target_entity_id": target_id,
            "start_time": timestamp,
            "end_time": "",
            "confidence": confidence,
            "source": "synthetic",
            "case_id": case_id,
            "evidence_id": evidence_id,
            "synthetic_flag": "true",
        })
        return rid_

    def generate_people(self):
        for i in range(1, self.n_persons + 1):
            self.make_person(self.new_id("PERSON"))

    def choose_network_size(self):
        return random.randint(8, 30)

    def build_networks(self):
        # Overlap is deliberate: bridge persons participate in multiple networks.
        network_count = max(12, min(30, self.n_cases // 35))
        person_ids = list(self.person_by_id)

        for ni in range(1, network_count + 1):
            nid = rid("NET", ni)
            archetype = random.choice(NETWORK_ARCHETYPES)
            size = min(self.choose_network_size(), len(person_ids))
            members = set(random.sample(person_ids, size))

            # Create a few high-connectivity bridge people.
            if ni > 1 and random.random() < 0.75:
                prior = list(self.network_members[rid("NET", random.randint(1, ni - 1))])
                if prior:
                    members.add(random.choice(prior))

            self.network_members[nid] = members
            for pid in members:
                self.network_members[nid].add(pid)
                self.truth_data["network_membership"].append({
                    "network_id": nid,
                    "network_type": archetype,
                    "person_id": pid,
                    "ground_truth_role": random.choice(
                        ["member", "associate", "coordinator", "bridge"]
                    ),
                    "synthetic_flag": "true",
                })

    def network_for_crime(self, crime):
        if crime in {"NARCOTICS_NDPS", "NARCOTICS_TRAFFICKING"}:
            return "NARCOTICS"
        if crime == "HUMAN_TRAFFICKING":
            return "HUMAN_TRAFFICKING"
        if crime in {"FINANCIAL_FRAUD", "FORGERY"}:
            return "FINANCIAL_FRAUD"
        if crime == "CYBERCRIME":
            return "CYBERCRIME"
        if crime in {"ROBBERY", "DACOITY"}:
            return "ROBBERY_DACOITY"
        if crime in {"KIDNAPPING", "KIDNAPPING_FOR_RANSOM"}:
            return "KIDNAPPING"
        return random.choice(["ORGANIZED_CRIME", "MIXED_CRIME"])

    def choose_network(self, preferred=None):
        candidates = []
        for nid, rows in self.truth_data["network_membership"].__class__ and []:
            pass
        ids = list(self.network_members)
        if preferred:
            preferred_ids = [
                nid for nid in ids
                if self.network_type(nid) == preferred
            ]
            if preferred_ids:
                ids = preferred_ids
        return random.choice(ids)

    def network_type(self, nid):
        for r in self.truth_data["network_membership"]:
            if r["network_id"] == nid:
                return r["network_type"]
        return "MIXED_CRIME"

    def add_person_asset_bundle(self, pid, incident):
        state = self.person_by_id[pid]["state"]
        # Most core members get multiple identifiers/assets.
        phone_count = 1 if random.random() < 0.78 else 2
        for _ in range(phone_count):
            self.make_phone(pid, incident)
            self.add_rel("PERSON", pid, "OWNS", "PHONE",
                         self.person_phones[pid][-1], iso(incident))

        if random.random() < 0.60:
            vid = self.make_vehicle(pid, state)
            self.add_rel("PERSON", pid, "OWNS", "VEHICLE", vid, iso(incident))

        account_count = 1 if random.random() < 0.80 else 2
        for _ in range(account_count):
            aid = self.make_account(pid, incident - timedelta(days=random.randint(1, 500)))
            self.add_rel("PERSON", pid, "OWNS", "ACCOUNT", aid, iso(incident))

    def create_case(self, case_index):
        required_crimes = [
            "MURDER", "RAPE", "KIDNAPPING", "HUMAN_TRAFFICKING",
            "NARCOTICS_TRAFFICKING", "ROBBERY", "DACOITY",
            "CYBERCRIME", "FINANCIAL_FRAUD"
        ]
        if case_index <= len(required_crimes):
            crime = required_crimes[case_index - 1]
            cat, sev = next((c, s) for cr, c, s in CRIMES if cr == crime)
        else:
            crime, cat, sev = random.choice(CRIMES)
        state = random.choice(STATES)
        district = f"District-{random.randint(1,40):02d}"
        incident = datetime(2023, 1, 1) + timedelta(
            days=random.randrange(365),
            hours=random.randrange(24),
            minutes=random.randrange(60)
        )
        case_id = rid("CASE", case_index)

        case = {
            "case_id": case_id,
            "crime_id": crime,
            "crime_type": crime,
            "crime_category": cat,
            "ipc_sections": "",
            "bns_sections": "",
            "severity": sev,
            "incident_date": incident.date().isoformat(),
            "incident_time": incident.time().isoformat(timespec="minutes"),
            "reported_date": (incident + timedelta(hours=random.randint(1,48))).date().isoformat(),
            "state": state,
            "district": district,
            "police_station": f"PS-{random.randint(1,25):02d}",
            "case_status": random.choice(["Open", "Under Investigation", "Charge-sheeted", "Closed"]),
            "description": "Synthetic investigation scenario",
            "synthetic_flag": "true",
        }
        self.data["cases"].append(case)
        self.case_by_id[case_id] = case

        lids = [self.make_location(state, district) for _ in range(random.randint(2,4))]
        preferred = self.network_for_crime(crime)
        nid = self.choose_network(preferred)
        members = list(self.network_members[nid])

        # 2-6 official subjects; additional members are observed rather than subjects.
        subject_count = min(random.randint(2,6), len(members))
        subjects = random.sample(members, subject_count)

        # Force at least one stable bridge into another case/network.
        if random.random() < 0.70:
            bridge_candidates = [
                p for n, ps in self.network_members.items()
                if n != nid for p in ps if p in self.person_by_id
            ]
            if bridge_candidates:
                subjects[-1] = random.choice(bridge_candidates)

        observed = set(random.sample(members, min(len(members), random.randint(2,8))))
        observed.update(subjects)

        self.case_networks[case_id].add(nid)
        for pid in observed:
            self.person_cases[pid].add(case_id)
            role = "suspect" if pid in subjects else "observed_associate"
            self.truth_data["entity_truth"].append({
                "case_id": case_id,
                "entity_id": pid,
                "actual_role": role,
                "is_relevant": "true" if pid in subjects else "false",
                "importance_score": 1.0 if pid in subjects else round(random.uniform(.25,.75), 2),
            })

        self.truth_data["case_truth"].append({
            "case_id": case_id,
            "network_id": nid,
            "crime_type": crime,
            "actual_primary_suspect": subjects[0],
            "actual_accomplices": ",".join(subjects[1:]),
            "actual_key_entities": ",".join(subjects),
            "actual_key_locations": ",".join(lids),
            "actual_key_evidence": "",
            "synthetic_flag": "true",
        })

        for pid in observed:
            self.add_person_asset_bundle(pid, incident)

        # Case relationships.
        for pid in subjects:
            self.add_rel("PERSON", pid, "SUSPECT_IN", "CASE", case_id, iso(incident), 1.0, case_id)

        for pid in observed - set(subjects):
            self.add_rel("PERSON", pid, "OBSERVED_IN", "CASE", case_id,
                         iso(incident), round(random.uniform(.65,.95),2), case_id)

        # Organization connected to network.
        oid = self.make_org(state, random.choice(lids), self.network_type(nid))
        self.add_rel("ORGANIZATION", oid, "ASSOCIATED_WITH", "CASE",
                     case_id, iso(incident), .82, case_id)

        # Member ↔ organization.
        for pid in random.sample(list(observed), min(len(observed), random.randint(1,3))):
            self.add_rel("PERSON", pid, random.choice(["WORKS_WITH", "MEMBER_OF", "CONTROLS"]),
                         "ORGANIZATION", oid, iso(incident), round(random.uniform(.7,.96),2), case_id)

        # Case events.
        event_ids = []
        for _ in range(random.randint(7,13)):
            eid = self.new_id("EVENT")
            pid = random.choice(list(observed))
            ph = random.choice(self.person_phones[pid])
            vehicle = random.choice(self.person_vehicles[pid]) if self.person_vehicles[pid] else ""
            t = incident + timedelta(minutes=random.randint(-480,480))
            self.data["events"].append({
                "event_id": eid,
                "case_id": case_id,
                "event_type": random.choice([
                    "CONTACT", "MOVEMENT", "REPORT", "OBSERVATION",
                    "MEETING", "TRANSPORT", "DIGITAL_ACTIVITY"
                ]),
                "timestamp": iso(t),
                "location_id": random.choice(lids),
                "person_id": pid,
                "vehicle_id": vehicle,
                "phone_id": ph,
                "description": "Synthetic timeline event",
                "source": "synthetic",
                "confidence": round(random.uniform(.60,.99),2),
                "synthetic_flag": "true",
            })
            event_ids.append(eid)

        # Evidence references real synthetic objects.
        evidence_ids = []
        for _ in range(random.randint(5,9)):
            evid = self.new_id("EVID")
            pid = random.choice(list(observed))
            ph = random.choice(self.person_phones[pid])
            vehicle = random.choice(self.person_vehicles[pid]) if self.person_vehicles[pid] else ""
            evidence = {
                "evidence_id": evid,
                "case_id": case_id,
                "evidence_type": random.choice([
                    "CCTV", "DIGITAL", "DOCUMENT", "PHONE",
                    "FINANCIAL", "PHYSICAL", "SURVEILLANCE"
                ]),
                "source": "Synthetic Source",
                "collected_at": iso(incident),
                "location_id": random.choice(lids),
                "related_person_id": pid,
                "related_vehicle_id": vehicle,
                "related_device_id": self.phone_by_id[ph]["device_id"],
                "description": "Synthetic evidence record",
                "reliability": round(random.uniform(.60,.99),2),
                "integrity_sha256": "",
                "synthetic_flag": "true",
            }
            evidence_for_hash = dict(evidence)
            evidence_for_hash["integrity_sha256"] = ""
            evidence["integrity_sha256"] = hash_row(evidence_for_hash)
            self.data["evidence"].append(evidence)
            evidence_ids.append(evid)

        # Update ground truth with key evidence.
        for gt in reversed(self.truth_data["case_truth"]):
            if gt["case_id"] == case_id:
                gt["actual_key_evidence"] = ",".join(evidence_ids[:3])
                break

        return case_id

    def generate_cdrs(self, target=20000):
        # First create dense within-network communication.
        pair_pool = []
        for nid, members in self.network_members.items():
            members = list(members)
            if len(members) < 2:
                continue
            for _ in range(max(20, len(members) * 8)):
                a, b = random.sample(members, 2)
                if self.person_phones[a] and self.person_phones[b]:
                    pair_pool.append((a,b,nid))

        while len(self.data["cdrs"]) < target:
            if pair_pool and random.random() < 0.78:
                a, b, nid = random.choice(pair_pool)
            else:
                a, b = random.sample(list(self.person_by_id), 2)
                nid = ""
            pa = random.choice(self.person_phones[a])
            pb = random.choice(self.person_phones[b])
            case_id = random.choice(list(self.case_by_id))
            case = self.case_by_id[case_id]
            base = datetime.fromisoformat(case["incident_date"] + "T" + case["incident_time"])
            t = base + timedelta(days=random.randint(-120,120), minutes=random.randint(-720,720))
            cdr = {
                "cdr_id": self.new_id("CDR"),
                "caller_phone_id": pa,
                "receiver_phone_id": pb,
                "timestamp": iso(t),
                "duration_seconds": random.randint(10,900),
                "call_type": random.choice(["VOICE", "SMS"]),
                "cell_tower_id": f"TOWER-{random.randint(1,800):04d}",
                "location_id": random.choice(self.data["locations"])["location_id"],
                "network_id": nid,
                "synthetic_flag": "true",
            }
            self.data["cdrs"].append(cdr)
            self.add_rel("PHONE", pa, "COMMUNICATION_LINK", "PHONE", pb,
                         iso(t), round(random.uniform(.75,.99),2), case_id)

    def generate_transactions(self, target=20000):
        accounts = list(self.account_by_id)
        if len(accounts) < 2:
            return
        same_network_accounts = []
        for nid, members in self.network_members.items():
            aa = []
            for pid in members:
                aa.extend(self.person_accounts.get(pid, []))
            if len(aa) >= 2:
                same_network_accounts.append((aa,nid))

        while len(self.data["transactions"]) < target:
            if same_network_accounts and random.random() < 0.82:
                aa, nid = random.choice(same_network_accounts)
                src, dst = random.sample(aa, 2)
            else:
                src, dst = random.sample(accounts, 2)
                nid = ""

            source_person = self.account_by_id[src]["person_id"]
            dest_person = self.account_by_id[dst]["person_id"]
            case_id = random.choice(list(self.case_by_id))
            case = self.case_by_id[case_id]
            base = datetime.fromisoformat(case["incident_date"] + "T" + case["incident_time"])
            t = base + timedelta(days=random.randint(-180,120), hours=random.randint(0,23))

            # Heavy-tailed synthetic amounts create meaningful financial analytics.
            amount = round(max(250, random.lognormvariate(math.log(12000), 1.0)), 2)
            if random.random() < .04:
                amount = round(random.uniform(150000, 1500000), 2)

            tx = {
                "transaction_id": self.new_id("TXN"),
                "source_account_id": src,
                "destination_account_id": dst,
                "timestamp": iso(t),
                "amount": amount,
                "transaction_type": random.choice(TRANSACTION_TYPES),
                "location_id": random.choice(self.data["locations"])["location_id"],
                "reference": f"SYNREF-{self.counters['TXN']:08d}",
                "network_id": nid,
                "synthetic_flag": "true",
            }
            self.data["transactions"].append(tx)
            self.add_rel("ACCOUNT", src, "TRANSACTED_WITH", "ACCOUNT", dst,
                         iso(t), round(random.uniform(.78,.99),2), case_id)

    def generate_aliases(self, target=1800):
        persons = list(self.person_by_id)
        used = set()
        while len(self.data["aliases"]) < target:
            pid = random.choice(persons)
            p = self.person_by_id[pid]
            base = p["name"].split()[0]
            alias = random.choice([
                base.lower() + str(random.randint(1,99)),
                base[:3].lower() + "_" + str(random.randint(10,999)),
                random.choice(["shadow", "falcon", "north", "raven", "orbit"]) +
                str(random.randint(1,99)),
                p["name"].split()[-1] + " Online",
            ])
            key = (pid, alias.lower())
            if key in used:
                continue
            used.add(key)
            aid = self.new_id("ALIAS")
            self.data["aliases"].append({
                "alias_id": aid,
                "person_id": pid,
                "alias": alias,
                "alias_type": random.choice(ALIAS_TYPES),
                "confidence": round(random.uniform(.62,.98),2),
                "synthetic_flag": "true",
            })
            self.add_rel("PERSON", pid, "USES", "ALIAS", aid,
                         confidence=round(random.uniform(.65,.98),2))

    def add_cross_case_hidden_links(self):
        # Ground truth describes relationships that are observable through
        # multiple hops but are deliberately not emitted as a direct edge.
        #
        # Examples:
        #   PERSON -> PHONE -> PHONE -> PERSON
        #   PERSON -> ACCOUNT -> ACCOUNT -> PERSON
        #   PERSON -> ORGANIZATION -> PERSON
        #
        # This is what graph/pathfinding/AI evaluation should recover.
        hidden_count = max(150, self.n_cases // 2)
        persons = list(self.person_by_id)
        for _ in range(hidden_count):
            a, b = random.sample(persons, 2)
            if a == b:
                continue

            shared_cases = self.person_cases[a].intersection(self.person_cases[b])
            shared_networks = {
                n for n in self.network_members
                if a in self.network_members[n] and b in self.network_members[n]
            }

            evidence = []
            if self.person_phones[a] and self.person_phones[b]:
                evidence.append("COMMUNICATION")
            if self.person_accounts[a] and self.person_accounts[b]:
                evidence.append("FINANCIAL")
            if self.person_vehicles[a] and self.person_vehicles[b]:
                evidence.append("ASSET")
            if a in self.person_cases and b in self.person_cases:
                evidence.append("CASE_OVERLAP")

            if not evidence:
                continue

            self.truth_data["hidden_relationships"].append({
                "hidden_relationship_id": self.new_id("HREL"),
                "source_person_id": a,
                "target_person_id": b,
                "relationship_class": random.choice([
                    "SHARED_NETWORK", "CROSS_CASE_ASSOCIATION",
                    "BRIDGE_RELATIONSHIP", "COMMON_INTERMEDIARY"
                ]),
                "observable_evidence_types": "|".join(evidence),
                "shared_case_ids": ",".join(sorted(shared_cases)),
                "shared_network_ids": ",".join(sorted(shared_networks)),
                "expected_min_hops": random.randint(2,4),
                "should_be_direct_edge": "false",
                "synthetic_flag": "true",
            })

    def generate_case_links(self):
        # Additional multi-case continuity: selected network members recur.
        for pid, cases in self.person_cases.items():
            if len(cases) >= 2:
                for c1, c2 in zip(sorted(cases), sorted(cases)[1:]):
                    self.truth_data["case_network_map"].append({
                        "person_id": pid,
                        "case_id_a": c1,
                        "case_id_b": c2,
                        "continuity_ground_truth": "true",
                        "synthetic_flag": "true",
                    })

    def generate(self):
        self.generate_people()
        self.build_networks()

        for i in range(1, self.n_cases + 1):
            self.create_case(i)

        # Ensure every person is addressable by at least one phone and
        # financially represented by at least one account. This prevents
        # isolated synthetic persons from becoming unusable graph nodes.
        for pid, person in self.person_by_id.items():
            if not self.person_phones[pid]:
                incident = datetime(2023, 1, 1) + timedelta(days=random.randrange(365))
                self.make_phone(pid, incident)
                self.add_rel("PERSON", pid, "OWNS", "PHONE",
                             self.person_phones[pid][-1], iso(incident))
            if not self.person_accounts[pid]:
                incident = datetime(2023, 1, 1) + timedelta(days=random.randrange(365))
                aid = self.make_account(pid, incident - timedelta(days=random.randint(1, 500)))
                self.add_rel("PERSON", pid, "OWNS", "ACCOUNT", aid, iso(incident))

        self.generate_cdrs(max(20000, self.n_cases * 20))
        self.generate_transactions(max(20000, self.n_cases * 20))
        self.generate_aliases(max(1800, self.n_persons // 2))
        self.add_cross_case_hidden_links()
        self.generate_case_links()

        self.write_all()
        return self.validate()

    def write_all(self):
        schemas = {
            "cases": [
                "case_id","crime_id","crime_type","crime_category","ipc_sections",
                "bns_sections","severity","incident_date","incident_time",
                "reported_date","state","district","police_station","case_status",
                "description","synthetic_flag"
            ],
            "persons": ["person_id","name","age","gender","role","occupation",
                        "state","district","synthetic_flag"],
            "locations": ["location_id","location_type","state","district","city",
                          "area","latitude","longitude","address_label","synthetic_flag"],
            "phones": ["phone_id","phone_number","person_id","device_id","carrier",
                       "activation_date","status","synthetic_flag"],
            "devices": ["device_id","device_type","person_id","os","first_seen",
                        "last_seen","synthetic_flag"],
            "organizations": ["organization_id","name","organization_type",
                              "location_id","network_type","status","synthetic_flag"],
            "vehicles": ["vehicle_id","vehicle_type","registration_alias",
                         "owner_person_id","color","make","model","status","synthetic_flag"],
            "accounts": ["account_id","person_id","institution_type","account_type",
                         "masked_identifier","opened_date","status","synthetic_flag"],
            "aliases": ["alias_id","person_id","alias","alias_type","confidence",
                        "synthetic_flag"],
            "cdrs": ["cdr_id","caller_phone_id","receiver_phone_id","timestamp",
                     "duration_seconds","call_type","cell_tower_id","location_id",
                     "network_id","synthetic_flag"],
            "transactions": ["transaction_id","source_account_id",
                             "destination_account_id","timestamp","amount",
                             "transaction_type","location_id","reference",
                             "network_id","synthetic_flag"],
            "events": ["event_id","case_id","event_type","timestamp","location_id",
                       "person_id","vehicle_id","phone_id","description","source",
                       "confidence","synthetic_flag"],
            "evidence": ["evidence_id","case_id","evidence_type","source",
                         "collected_at","location_id","related_person_id",
                         "related_vehicle_id","related_device_id","description",
                         "reliability","integrity_sha256","synthetic_flag"],
            "relationships": ["relationship_id","source_entity_type","source_entity_id",
                              "relationship_type","target_entity_type",
                              "target_entity_id","start_time","end_time",
                              "confidence","source","case_id","evidence_id",
                              "synthetic_flag"],
        }

        for name, fields in schemas.items():
            write_csv(self.syn, name, self.data[name], fields)

        truth_schemas = {
            "case_truth": [
                "case_id","network_id","crime_type","actual_primary_suspect",
                "actual_accomplices","actual_key_entities","actual_key_locations",
                "actual_key_evidence","synthetic_flag"
            ],
            "relationship_truth": [
                "truth_id","source_entity","relationship","target_entity",
                "is_true","synthetic_flag"
            ],
            "entity_truth": [
                "case_id","entity_id","actual_role","is_relevant",
                "importance_score"
            ],
            "network_membership": [
                "network_id","network_type","person_id","ground_truth_role",
                "synthetic_flag"
            ],
            "hidden_relationships": [
                "hidden_relationship_id","source_person_id","target_person_id",
                "relationship_class","observable_evidence_types",
                "shared_case_ids","shared_network_ids","expected_min_hops",
                "should_be_direct_edge","synthetic_flag"
            ],
            "case_network_map": [
                "person_id","case_id_a","case_id_b",
                "continuity_ground_truth","synthetic_flag"
            ],
        }

        # Preserve compatibility with the original relationship_truth idea.
        for row in self.data["relationships"][:]:
            if row["relationship_type"] in {"SUSPECT_IN", "OBSERVED_IN"}:
                self.truth_data["relationship_truth"].append({
                    "truth_id": self.new_id("TRUTH"),
                    "source_entity": row["source_entity_id"],
                    "relationship": row["relationship_type"],
                    "target_entity": row["target_entity_id"],
                    "is_true": "true",
                    "synthetic_flag": "true",
                })

        for name, fields in truth_schemas.items():
            write_csv(self.truth, name, self.truth_data[name], fields)

        manifest = {
            "generator": "generate_sherlock_synthetic_v2.py",
            "seed": self.seed,
            "synthetic_only_individual_data": True,
            "ncrb_role": "aggregate/statistical foundation only",
            "entities": {k: len(v) for k, v in self.data.items()},
            "ground_truth": {k: len(v) for k, v in self.truth_data.items()},
        }
        (self.syn / "DATASET_MANIFEST.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8"
        )

    # -----------------------------
    # Automated validation
    # -----------------------------
    def validate(self):
        errors = []
        warnings = []
        checks = []

        def check(name, condition, detail):
            checks.append({
                "check": name,
                "status": "PASS" if condition else "FAIL",
                "detail": detail,
            })
            if not condition:
                errors.append(f"{name}: {detail}")

        def ids(rows, key):
            return {r[key] for r in rows}

        entity_sets = {
            "CASE": ids(self.data["cases"], "case_id"),
            "PERSON": ids(self.data["persons"], "person_id"),
            "LOCATION": ids(self.data["locations"], "location_id"),
            "PHONE": ids(self.data["phones"], "phone_id"),
            "DEVICE": ids(self.data["devices"], "device_id"),
            "ORGANIZATION": ids(self.data["organizations"], "organization_id"),
            "VEHICLE": ids(self.data["vehicles"], "vehicle_id"),
            "ACCOUNT": ids(self.data["accounts"], "account_id"),
            "ALIAS": ids(self.data["aliases"], "alias_id"),
            "EVENT": ids(self.data["events"], "event_id"),
            "EVIDENCE": ids(self.data["evidence"], "evidence_id"),
        }

        for name in [
            "cases","persons","locations","phones","devices","organizations",
            "vehicles","accounts","aliases","cdrs","transactions","events",
            "evidence","relationships"
        ]:
            check(
                f"non_empty_{name}",
                len(self.data[name]) > 0,
                f"{len(self.data[name])} records"
            )

        check("case_count", len(self.data["cases"]) == self.n_cases,
              f"expected {self.n_cases}, got {len(self.data['cases'])}")

        check("person_count", len(self.data["persons"]) == self.n_persons,
              f"expected {self.n_persons}, got {len(self.data['persons'])}")

        # Duplicate canonical IDs.
        for name, key in [
            ("cases","case_id"),("persons","person_id"),("phones","phone_id"),
            ("vehicles","vehicle_id"),("accounts","account_id"),
            ("organizations","organization_id"),("aliases","alias_id")
        ]:
            vals = [r[key] for r in self.data[name]]
            check(f"unique_{name}_ids", len(vals) == len(set(vals)),
                  "duplicate canonical identifiers detected")

        # Referential integrity for generic relationships.
        orphan_rel = 0
        for r in self.data["relationships"]:
            if r["source_entity_id"] not in entity_sets.get(r["source_entity_type"], set()):
                orphan_rel += 1
            if r["target_entity_id"] not in entity_sets.get(r["target_entity_type"], set()):
                orphan_rel += 1
        check("relationship_referential_integrity", orphan_rel == 0,
              f"{orphan_rel} orphan relationship endpoints")

        # Specific table FKs.
        phone_orphans = sum(
            p["person_id"] not in entity_sets["PERSON"] or
            p["device_id"] not in entity_sets["DEVICE"]
            for p in self.data["phones"]
        )
        check("phone_fk_integrity", phone_orphans == 0,
              f"{phone_orphans} invalid phone references")

        account_orphans = sum(
            a["person_id"] not in entity_sets["PERSON"]
            for a in self.data["accounts"]
        )
        check("account_fk_integrity", account_orphans == 0,
              f"{account_orphans} invalid account references")

        vehicle_orphans = sum(
            v["owner_person_id"] not in entity_sets["PERSON"]
            for v in self.data["vehicles"]
        )
        check("vehicle_fk_integrity", vehicle_orphans == 0,
              f"{vehicle_orphans} invalid vehicle references")

        alias_orphans = sum(
            a["person_id"] not in entity_sets["PERSON"]
            for a in self.data["aliases"]
        )
        check("alias_fk_integrity", alias_orphans == 0,
              f"{alias_orphans} invalid alias references")

        cdr_orphans = sum(
            c["caller_phone_id"] not in entity_sets["PHONE"] or
            c["receiver_phone_id"] not in entity_sets["PHONE"] or
            c["location_id"] not in entity_sets["LOCATION"]
            for c in self.data["cdrs"]
        )
        check("cdr_fk_integrity", cdr_orphans == 0,
              f"{cdr_orphans} invalid CDR references")

        tx_orphans = sum(
            t["source_account_id"] not in entity_sets["ACCOUNT"] or
            t["destination_account_id"] not in entity_sets["ACCOUNT"] or
            t["location_id"] not in entity_sets["LOCATION"]
            for t in self.data["transactions"]
        )
        check("transaction_fk_integrity", tx_orphans == 0,
              f"{tx_orphans} invalid transaction references")

        event_orphans = sum(
            e["case_id"] not in entity_sets["CASE"] or
            e["location_id"] not in entity_sets["LOCATION"] or
            e["person_id"] not in entity_sets["PERSON"] or
            bool(e["phone_id"]) and e["phone_id"] not in entity_sets["PHONE"] or
            bool(e["vehicle_id"]) and e["vehicle_id"] not in entity_sets["VEHICLE"]
            for e in self.data["events"]
        )
        check("event_fk_integrity", event_orphans == 0,
              f"{event_orphans} invalid event references")

        evidence_orphans = sum(
            e["case_id"] not in entity_sets["CASE"] or
            e["location_id"] not in entity_sets["LOCATION"] or
            e["related_person_id"] not in entity_sets["PERSON"] or
            bool(e["related_vehicle_id"]) and e["related_vehicle_id"] not in entity_sets["VEHICLE"] or
            bool(e["related_device_id"]) and e["related_device_id"] not in entity_sets["DEVICE"]
            for e in self.data["evidence"]
        )
        check("evidence_fk_integrity", evidence_orphans == 0,
              f"{evidence_orphans} invalid evidence references")

        # No self CDR / transaction.
        self_cdr = sum(c["caller_phone_id"] == c["receiver_phone_id"] for c in self.data["cdrs"])
        check("cdr_no_self_calls", self_cdr == 0,
              f"{self_cdr} self-call records")

        self_tx = sum(t["source_account_id"] == t["destination_account_id"]
                      for t in self.data["transactions"])
        check("transaction_no_self_transfer", self_tx == 0,
              f"{self_tx} self-transfer records")

        # Temporal sanity.
        bad_dates = 0
        for c in self.data["cases"]:
            try:
                incident = datetime.fromisoformat(c["incident_date"] + "T" + c["incident_time"])
                reported = datetime.fromisoformat(c["reported_date"] + "T00:00:00")
                if reported.date() < incident.date():
                    bad_dates += 1
            except Exception:
                bad_dates += 1
        check("case_temporal_sanity", bad_dates == 0,
              f"{bad_dates} impossible case dates")

        # Every case should have subjects, events and evidence.
        case_ids = set(self.case_by_id)
        cases_with_subjects = {
            r["case_id"] for r in self.truth_data["entity_truth"]
            if r["actual_role"] == "suspect"
        }
        cases_with_events = {r["case_id"] for r in self.data["events"]}
        cases_with_evidence = {r["case_id"] for r in self.data["evidence"]}
        check("every_case_has_subject", cases_with_subjects == case_ids,
              f"{len(case_ids - cases_with_subjects)} cases without subject")
        check("every_case_has_events", cases_with_events == case_ids,
              f"{len(case_ids - cases_with_events)} cases without events")
        check("every_case_has_evidence", cases_with_evidence == case_ids,
              f"{len(case_ids - cases_with_evidence)} cases without evidence")

        # Network richness.
        network_sizes = {
            nid: len(members) for nid, members in self.network_members.items()
        }
        check("multiple_networks", len(network_sizes) >= 10,
              f"{len(network_sizes)} networks")
        check("network_overlap_exists",
              any(len(ps) >= 2 for ps in self.network_members.values()),
              "no network members generated")

        # Hidden relationship benchmark.
        check("hidden_relationship_benchmark",
              len(self.truth_data["hidden_relationships"]) >= 100,
              f"{len(self.truth_data['hidden_relationships'])} hidden links")

        # Ground-truth isolation check: operational CSVs must not contain
        # explicit ground-truth columns.
        forbidden = {"actual_primary_suspect", "actual_accomplices",
                     "ground_truth_role", "should_be_direct_edge"}
        leakage = []
        for name, rows in self.data.items():
            if rows:
                leakage.extend(forbidden.intersection(rows[0].keys()))
        check("ground_truth_isolation", not leakage,
              f"ground-truth fields leaked into operational data: {sorted(set(leakage))}")

        # Synthetic flag check.
        non_synthetic = []
        for name, rows in self.data.items():
            for r in rows:
                if r.get("synthetic_flag") != "true":
                    non_synthetic.append((name, r))
                    if len(non_synthetic) > 5:
                        break
        check("synthetic_flags", not non_synthetic,
              f"{len(non_synthetic)} records missing synthetic_flag=true")

        # Evidence integrity hashes.
        bad_hashes = 0
        for e in self.data["evidence"]:
            original = dict(e)
            expected = original.pop("integrity_sha256")
            original["integrity_sha256"] = ""
            if hash_row(original) != expected:
                bad_hashes += 1
        check("evidence_sha256_integrity", bad_hashes == 0,
              f"{bad_hashes} evidence hashes invalid")

        # Crime coverage.
        crime_counts = Counter(c["crime_type"] for c in self.data["cases"])
        required = {
            "MURDER", "RAPE", "KIDNAPPING", "HUMAN_TRAFFICKING",
            "NARCOTICS_TRAFFICKING", "ROBBERY", "DACOITY",
            "CYBERCRIME", "FINANCIAL_FRAUD"
        }
        missing = sorted(required - set(crime_counts))
        check("serious_crime_coverage", not missing,
              f"missing categories: {missing}")

        # Relationship diversity.
        rel_types = {r["relationship_type"] for r in self.data["relationships"]}
        check("relationship_diversity", len(rel_types) >= 8,
              f"{len(rel_types)} relationship types")

        # Warning if graph is too sparse.
        if len(self.data["relationships"]) < len(self.data["persons"]) * 3:
            warnings.append("Relationship graph may be sparse for centrality analysis.")

        report = {
            "generated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "seed": self.seed,
            "status": "PASS" if not errors else "FAIL",
            "errors": errors,
            "warnings": warnings,
            "checks": checks,
            "counts": {k: len(v) for k, v in self.data.items()},
            "ground_truth_counts": {k: len(v) for k, v in self.truth_data.items()},
            "crime_distribution": dict(crime_counts),
        }

        (self.syn / "VALIDATION_REPORT.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )
        write_csv(
            self.syn, "VALIDATION_CHECKS",
            checks,
            ["check", "status", "detail"]
        )

        print("\n=== SHERLOCK SYNTHETIC V2 ===")
        print("Seed:", self.seed)
        for k, v in self.data.items():
            print(f"{k:16s}: {len(v):>7}")
        print("\nGround truth:")
        for k, v in self.truth_data.items():
            print(f"{k:24s}: {len(v):>7}")
        print("\nValidation:", report["status"])
        if errors:
            for e in errors[:20]:
                print("  FAIL:", e)
        else:
            print("  All automated validation checks passed.")
        print("\nOutput:")
        print(" ", self.syn)
        print(" ", self.truth)
        return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=str(DEFAULT_BASE))
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--cases", type=int, default=1000)
    parser.add_argument("--persons", type=int, default=3000)
    args = parser.parse_args()

    if args.cases < 1 or args.persons < 10:
        parser.error("cases must be >= 1 and persons must be >= 10")

    generator = Generator(
        base=args.base,
        seed=args.seed,
        n_cases=args.cases,
        n_persons=args.persons,
    )
    report = generator.generate()
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
