import os
import sys
import pandas as pd
import pymongo
from pymongo import MongoClient, UpdateOne

CSV_PATH = os.path.join(os.path.dirname(__file__), 'SYNTHETIC', 'persons_realistic_synthetic.csv')

def get_field_value(val, is_int=False):
    if pd.isna(val) or val is None or str(val).strip() == '':
        return 'Not available'
    if is_int:
        try:
            return int(val)
        except (ValueError, TypeError):
            return 'Not available'
    return str(val).strip()

def run_update(mongo_uri, db_name="sherlock"):
    print(f"Reading CSV from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} rows from CSV.")

    print(f"Connecting to MongoDB at {mongo_uri}...")
    client = MongoClient(
        mongo_uri, 
        serverSelectionTimeoutMS=5000, 
        tlsAllowInvalidCertificates=True
    )
    db = client[db_name]

    # Verify collection exists without dropping it
    initial_count = db.persons.count_documents({})
    print(f"Initial persons count in database '{db_name}': {initial_count}")

    operations = []
    for idx, row in df.iterrows():
        pid = str(row['person_id']).strip()
        
        doc = {
            'person_id': pid,
            'name': get_field_value(row.get('name')),
            'age': get_field_value(row.get('age'), is_int=True),
            'gender': get_field_value(row.get('gender')),
            'role': get_field_value(row.get('role')),
            'occupation': get_field_value(row.get('occupation')),
            'state': get_field_value(row.get('state')),
            'district': get_field_value(row.get('district')),
            'synthetic_flag': str(row.get('synthetic_flag', 'true')).lower(),
            'eye_color': get_field_value(row.get('eye_color')),
            'hair_color': get_field_value(row.get('hair_color')),
            'blood_type': get_field_value(row.get('blood_type')),
            'marital_status': get_field_value(row.get('marital_status')),
            'address': get_field_value(row.get('address'))
        }
        
        # Match strictly by person_id and update only person fields
        operations.append(UpdateOne({'person_id': pid}, {'$set': doc}, upsert=True))

    if operations:
        result = db.persons.bulk_write(operations)
        print(f"Update Result -> Matched: {result.matched_count}, Modified: {result.modified_count}, Upserted: {result.upserted_count}")

    final_count = db.persons.count_documents({})
    print(f"Final persons count in database '{db_name}': {final_count}")
    
    # Sample verification
    sample_doc = db.persons.find_one({'person_id': 'PERSON-000001'}, {'_id': 0})
    print("Sample updated document (PERSON-000001):")
    print(sample_doc)

if __name__ == '__main__':
    # Update local MongoDB
    try:
        print("--- Updating Local MongoDB ---")
        run_update('mongodb://127.0.0.1:27017')
    except Exception as e:
        print(f"Local MongoDB update error: {e}")

    # Also update Atlas MongoDB if configured
    atlas_uri = os.getenv("MONGODB_URI", "mongodb+srv://Vitamin_Ai:vitaminAi_sih_2026@cluster0.eyjoi6q.mongodb.net/sherlock?appName=Cluster0")
    if atlas_uri:
        try:
            print("--- Updating Atlas MongoDB ---")
            run_update(atlas_uri)
        except Exception as e:
            print(f"Atlas MongoDB update note: {e}")
