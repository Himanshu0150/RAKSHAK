import os
from pymongo import AsyncMongoClient
from app.core.config import settings

class MongoDBManager:
    client: AsyncMongoClient = None
    db = None

db_manager = MongoDBManager()

async def connect_to_mongo():
    is_prod = os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"
    try:
        db_manager.client = AsyncMongoClient(
            settings.mongodb_uri,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000
        )
        db_manager.db = db_manager.client[settings.mongodb_database]
        # Ping database to verify connection
        await db_manager.client.admin.command('ping')
        print(f"[SHERLOCK BACKEND] Successfully connected and pinged MongoDB Atlas database: '{settings.mongodb_database}'")
    except Exception as e:
        if is_prod:
            print(f"[SHERLOCK BACKEND ERROR] Production MongoDB Atlas connection failed ({e}). Fallback disabled in production.")
            raise e
        print(f"[SHERLOCK BACKEND WARNING] Could not ping MongoDB Atlas ({e}). Trying local MongoDB connection...")
        try:
            db_manager.client = AsyncMongoClient(
                "mongodb://127.0.0.1:27017",
                serverSelectionTimeoutMS=3000
            )
            db_manager.db = db_manager.client[settings.mongodb_database]
            await db_manager.client.admin.command('ping')
            print(f"[SHERLOCK BACKEND] Successfully connected and pinged local MongoDB database: '{settings.mongodb_database}'")
        except Exception as e2:
            print(f"[SHERLOCK BACKEND ERROR] Could not connect to local MongoDB database either: {e2}")


async def close_mongo_connection():
    if db_manager.client:
        await db_manager.client.close()
        print("[SHERLOCK BACKEND] PyMongo Async connection closed.")

def get_database():
    return db_manager.db

