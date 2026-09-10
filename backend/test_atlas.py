import asyncio
from pymongo import AsyncMongoClient
from app.core.config import settings

async def main():
    client = AsyncMongoClient(
        settings.mongodb_uri,
        tls=True,
        tlsAllowInvalidCertificates=True,
        serverSelectionTimeoutMS=10000
    )

    try:
        result = await client.admin.command("ping")
        print("ATLAS CONNECTION: SUCCESS")
        print("PING:", result)
        print("DATABASE:", settings.mongodb_database)
    except Exception as e:
        print("ATLAS CONNECTION: FAILED")
        print(type(e).__name__, str(e))
    finally:
        await client.close()

asyncio.run(main())
