from pathlib import Path
import csv, random
from datetime import datetime, timedelta

BASE = Path(r"E:\SIH\Data")
SYN = BASE/"SYNTHETIC"
TRUTH = BASE/"GROUND_TRUTH"
for d in (SYN,TRUTH): d.mkdir(parents=True,exist_ok=True)

random.seed(20260901)
CRIMES=[
("MURDER","Violent Crime","CRITICAL"),("ATTEMPTED_MURDER","Violent Crime","CRITICAL"),
("CULPABLE_HOMICIDE","Violent Crime","CRITICAL"),("RAPE","Sexual Crime","CRITICAL"),
("ATTEMPTED_RAPE","Sexual Crime","CRITICAL"),("KIDNAPPING","Kidnapping/Abduction","CRITICAL"),
("KIDNAPPING_FOR_RANSOM","Kidnapping/Abduction","CRITICAL"),("HUMAN_TRAFFICKING","Trafficking","CRITICAL"),
("CHILD_RELATED_CRIME","Crime Against Children","CRITICAL"),("CRUELTY_BY_HUSBAND_OR_RELATIVES","Crime Against Women","HIGH"),
("NARCOTICS_NDPS","Narcotics","HIGH"),("NARCOTICS_TRAFFICKING","Narcotics","CRITICAL"),
("ROBBERY","Property/Violent Crime","HIGH"),("DACOITY","Property/Violent Crime","CRITICAL"),
("THEFT","Property Crime","MEDIUM"),("BURGLARY","Property Crime","MEDIUM"),("VEHICLE_THEFT","Property Crime","MEDIUM"),
("EXTORTION","Organized/Financial Crime","HIGH"),("ASSAULT","Violent Crime","HIGH"),
("FINANCIAL_FRAUD","Financial Crime","HIGH"),("CYBERCRIME","Cybercrime","HIGH"),("FORGERY","Financial Crime","MEDIUM"),
("OTHER_SPECIAL_LOCAL_LAWS","Special/Local Law","MEDIUM")]
STATES=["Maharashtra","Delhi","Karnataka","Tamil Nadu","Uttar Pradesh","Gujarat","Rajasthan","West Bengal","Telangana","Kerala"]
FIRST=["Aarav","Vihaan","Aditya","Kabir","Arjun","Rohan","Ishaan","Neel","Anaya","Diya","Meera","Ira","Riya","Kavya"]
LAST=["Sharma","Patel","Verma","Singh","Khan","Mehta","Rao","Das","Joshi","Nair","Gupta","Iyer"]

def rid(p,n): return f"{p}-{n:06d}"
def write(name,rows):
    fields=list(rows[0]) if rows else {
      "organizations":["organization_id","name","organization_type","location_id","status","synthetic_flag"],
      "vehicles":["vehicle_id","vehicle_type","registration_alias","owner_person_id","color","make","model","synthetic_flag"],
      "accounts":["account_id","person_id","institution_type","account_type","masked_identifier","opened_date","status","synthetic_flag"],
      "transactions":["transaction_id","source_account_id","destination_account_id","timestamp","amount","transaction_type","location_id","reference","synthetic_flag"],
      "aliases":["alias_id","person_id","alias","alias_type","confidence","synthetic_flag"]}.get(name,[])
    with open(SYN/(name+".csv"),"w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)

cases=[]; persons=[]; locations=[]; phones=[]; devices=[]; cdrs=[]; events=[]; evidence=[]; rels=[]
case_truth=[]; rel_truth=[]; entity_truth=[]
pc=lc=phc=dc=cc=ec=evc=rc=0

for i in range(1,1001):
    case=rid("CASE",i); crime,cat,sev=random.choice(CRIMES); state=random.choice(STATES)
    incident=datetime(2023,1,1)+timedelta(days=random.randrange(365),hours=random.randrange(24),minutes=random.randrange(60))
    cases.append({"case_id":case,"crime_id":crime,"crime_type":crime,"crime_category":cat,"ipc_sections":"","bns_sections":"",
                  "severity":sev,"incident_date":incident.date().isoformat(),"incident_time":incident.time().isoformat(timespec="minutes"),
                  "reported_date":(incident+timedelta(hours=random.randint(1,48))).date().isoformat(),"state":state,
                  "district":f"District-{random.randint(1,40):02d}","police_station":f"PS-{random.randint(1,25):02d}",
                  "case_status":random.choice(["Open","Under Investigation","Charge-sheeted","Closed"]),
                  "description":"Synthetic investigation scenario","synthetic_flag":"true"})
    involved=[]
    for role in ("victim","suspect","witness"):
        pc+=1; pid=rid("PERSON",pc)
        persons.append({"person_id":pid,"name":random.choice(FIRST)+" "+random.choice(LAST),"age":random.randint(18,65),
                        "gender":random.choice(["Female","Male"]),"role":role,"occupation":random.choice(["Employee","Business","Student","Driver","Contractor"]),
                        "state":state,"district":cases[-1]["district"],"synthetic_flag":"true"})
        involved.append(pid); entity_truth.append({"case_id":case,"entity_id":pid,"actual_role":role,"is_relevant":"true" if role=="suspect" else "false","importance_score":1.0 if role=="suspect" else 0.4})
    suspect=involved[1]
    case_truth.append({"case_id":case,"actual_primary_suspect":suspect,"actual_accomplices":"","actual_key_entities":suspect,"actual_key_locations":"","actual_key_evidence":""})
    lids=[]
    for _ in range(2):
        lc+=1; lid=rid("LOC",lc); lids.append(lid)
        locations.append({"location_id":lid,"location_type":random.choice(["Residence","Road","Commercial","Public","Transit"]),
                          "state":state,"district":cases[-1]["district"],"city":f"City-{random.randint(1,20):02d}","area":f"Area-{random.randint(1,100):03d}",
                          "latitude":round(random.uniform(8,34),6),"longitude":round(random.uniform(68,97),6),
                          "address_label":f"Synthetic Location {lc}","synthetic_flag":"true"})
    case_truth[-1]["actual_key_locations"]=",".join(lids)
    pids=involved
    for pid in pids:
        phc+=1; dc+=1; ph=rid("PHONE",phc); dev=rid("DEVICE",dc)
        phones.append({"phone_id":ph,"phone_number":"+91-SYN-"+f"{phc:08d}","person_id":pid,"device_id":dev,"carrier":"SyntheticTel",
                       "activation_date":"2023-01-01","status":"Active","synthetic_flag":"true"})
        devices.append({"device_id":dev,"device_type":"Smartphone","person_id":pid,"os":random.choice(["Android","iOS"]),
                         "first_seen":incident.date().isoformat(),"last_seen":incident.date().isoformat(),"synthetic_flag":"true"})
        rc+=1; rels.append({"relationship_id":rid("REL",rc),"source_entity_type":"PERSON","source_entity_id":pid,"relationship_type":"OWNS",
                             "target_entity_type":"PHONE","target_entity_id":ph,"start_time":incident.isoformat(),"end_time":"",
                             "confidence":1.0,"source":"synthetic","case_id":case,"synthetic_flag":"true"})
    phids=[x["phone_id"] for x in phones[-3:]]
    for _ in range(8):
        cc+=1; t=incident+timedelta(minutes=random.randint(-180,180))
        cdrs.append({"cdr_id":rid("CDR",cc),"caller_phone_id":random.choice(phids),"receiver_phone_id":random.choice(phids),
                     "timestamp":t.isoformat(),"duration_seconds":random.randint(10,900),"call_type":random.choice(["VOICE","SMS"]),
                     "cell_tower_id":f"TOWER-{random.randint(1,500):04d}","location_id":random.choice(lids),"synthetic_flag":"true"})
    for _ in range(5):
        ec+=1; events.append({"event_id":rid("EVENT",ec),"case_id":case,"event_type":random.choice(["CONTACT","MOVEMENT","REPORT","OBSERVATION"]),
                              "timestamp":(incident+timedelta(minutes=random.randint(-240,240))).isoformat(),"location_id":random.choice(lids),
                              "person_id":random.choice(pids),"vehicle_id":"","phone_id":random.choice(phids),"description":"Synthetic timeline event",
                              "source":"synthetic","confidence":round(random.uniform(.6,.99),2),"synthetic_flag":"true"})
    for _ in range(3):
        evc+=1; eid=rid("EVID",evc)
        evidence.append({"evidence_id":eid,"case_id":case,"evidence_type":random.choice(["CCTV","DIGITAL","DOCUMENT","PHONE","FINANCIAL","PHYSICAL"]),
                         "source":"Synthetic Source","collected_at":incident.isoformat(),"location_id":random.choice(lids),"related_person_id":suspect,
                         "related_vehicle_id":"","related_device_id":"","description":"Synthetic evidence record","reliability":round(random.uniform(.6,.99),2),"synthetic_flag":"true"})
    rc+=1; rels.append({"relationship_id":rid("REL",rc),"source_entity_type":"PERSON","source_entity_id":suspect,"relationship_type":"SUSPECT_IN",
                        "target_entity_type":"CASE","target_entity_id":case,"start_time":incident.isoformat(),"end_time":"",
                        "confidence":1.0,"source":"synthetic","case_id":case,"synthetic_flag":"true"})
    rel_truth.append({"case_id":case,"source_entity":suspect,"relationship":"SUSPECT_IN","target_entity":case,"is_true":"true"})

for n,r in [("cases",cases),("persons",persons),("locations",locations),("phones",phones),("devices",devices),("cdrs",cdrs),("events",events),("evidence",evidence),("relationships",rels)]:
    write(n,r)
for n in ("organizations","vehicles","accounts","transactions","aliases"):
    write(n,[])
def truth(name,rows):
    with open(TRUTH/name,"w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
truth("case_truth.csv",case_truth); truth("relationship_truth.csv",rel_truth); truth("entity_truth.csv",entity_truth)

print("Generated 1,000 synthetic cases.")
print("Persons:",len(persons),"Phones:",len(phones),"CDRs:",len(cdrs),"Events:",len(events),"Evidence:",len(evidence),"Relationships:",len(rels))
print("All individual records are synthetic.")
