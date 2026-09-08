import hashlib
import asyncio
from pymongo import UpdateOne
from app.db.mongodb import get_database, connect_to_mongo, close_mongo_connection

def generate_biographical_fields(person_id: str, age: int = 35) -> dict:
    pid = str(person_id or "").strip()
    
    # 1. Eye Color
    eye_hash = int(hashlib.sha256(f"{pid}_eye".encode('utf-8')).hexdigest(), 16) % 100
    if eye_hash < 45:
        eye_color = "Brown"
    elif eye_hash < 75:
        eye_color = "Dark Brown"
    elif eye_hash < 93:
        eye_color = "Black"
    elif eye_hash < 98:
        eye_color = "Hazel"
    else:
        eye_color = "Grey"

    # 2. Hair Color
    hair_hash = int(hashlib.sha256(f"{pid}_hair".encode('utf-8')).hexdigest(), 16) % 100
    if age >= 55:
        if hair_hash < 20: hair_color = "Black"
        elif hair_hash < 30: hair_color = "Dark Brown"
        elif hair_hash < 40: hair_color = "Brown"
        elif hair_hash < 70: hair_color = "Grey"
        else: hair_color = "Salt and Pepper"
    elif age >= 45:
        if hair_hash < 40: hair_color = "Black"
        elif hair_hash < 60: hair_color = "Dark Brown"
        elif hair_hash < 75: hair_color = "Brown"
        elif hair_hash < 85: hair_color = "Grey"
        else: hair_color = "Salt and Pepper"
    else:
        if hair_hash < 60: hair_color = "Black"
        elif hair_hash < 85: hair_color = "Dark Brown"
        else: hair_color = "Brown"

    # 3. Blood Type
    blood_hash = int(hashlib.sha256(f"{pid}_blood".encode('utf-8')).hexdigest(), 16) % 1000
    if blood_hash < 330: blood_type = "B+"
    elif blood_hash < 650: blood_type = "O+"
    elif blood_hash < 850: blood_type = "A+"
    elif blood_hash < 920: blood_type = "AB+"
    elif blood_hash < 950: blood_type = "O-"
    elif blood_hash < 980: blood_type = "B-"
    elif blood_hash < 995: blood_type = "A-"
    else: blood_type = "AB-"

    # 4. Marital Status
    marital_hash = int(hashlib.sha256(f"{pid}_marital".encode('utf-8')).hexdigest(), 16) % 100
    if age < 22:
        marital_status = "Single" if marital_hash < 95 else "Married"
    elif age < 30:
        if marital_hash < 45: marital_status = "Single"
        elif marital_hash < 95: marital_status = "Married"
        else: marital_status = "Divorced"
    elif age < 60:
        if marital_hash < 75: marital_status = "Married"
        elif marital_hash < 85: marital_status = "Single"
        elif marital_hash < 97: marital_status = "Divorced"
        else: marital_status = "Widowed"
    else:
        if marital_hash < 60: marital_status = "Married"
        elif marital_hash < 85: marital_status = "Widowed"
        elif marital_hash < 95: marital_status = "Divorced"
        else: marital_status = "Single"

    return {
        "eye_color": eye_color,
        "hair_color": hair_color,
        "blood_type": blood_type,
        "marital_status": marital_status
    }

async def migrate_biographical_data():
    db = get_database()
    if db is None:
        print("[SHERLOCK MIGRATION WARNING] Database connection not available.")
        return

    missing_query = {
        "$or": [
            {"eye_color": {"$exists": False}},
            {"hair_color": {"$exists": False}},
            {"blood_type": {"$exists": False}},
            {"marital_status": {"$exists": False}},
            {"eye_color": None},
            {"hair_color": None},
            {"blood_type": None},
            {"marital_status": None}
        ]
    }

    cursor = db.persons.find(missing_query)
    persons_to_update = await cursor.to_list(length=20000)

    if not persons_to_update:
        print("[SHERLOCK MIGRATION] All persons in MongoDB already have biographical data. No updates needed.")
        return

    print(f"[SHERLOCK MIGRATION] Found {len(persons_to_update)} person records needing biographical data update...")

    bulk_ops = []

    for p in persons_to_update:
        pid = p.get("person_id") or str(p.get("_id"))
        age = p.get("age", 35)
        if not isinstance(age, (int, float)):
            try:
                age = int(age)
            except Exception:
                age = 35

        gen_fields = generate_biographical_fields(pid, int(age))
        
        set_dict = {}
        for field in ["eye_color", "hair_color", "blood_type", "marital_status"]:
            if p.get(field) is None:
                set_dict[field] = gen_fields[field]

        if set_dict:
            bulk_ops.append(
                UpdateOne({"_id": p["_id"]}, {"$set": set_dict})
            )

    if bulk_ops:
        res = await db.persons.bulk_write(bulk_ops)
        print(f"[SHERLOCK MIGRATION SUCCESS] Updated {res.modified_count} persons in MongoDB with realistic biographical data.")
    else:
        print("[SHERLOCK MIGRATION] No records were modified.")

if __name__ == "__main__":
    async def main():
        await connect_to_mongo()
        await migrate_biographical_data()
        await close_mongo_connection()

    asyncio.run(main())
