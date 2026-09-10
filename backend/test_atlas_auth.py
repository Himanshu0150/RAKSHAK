import asyncio
from pymongo import AsyncMongoClient
from app.core.config import settings


async def main():
    client = AsyncMongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=10000,
    )

    try:
        result = await client.admin.command("ping")
        print("PING:", result)

        status = await client.admin.command("connectionStatus")
        print("AUTHENTICATED USERS:")
        print(status["authInfo"]["authenticatedUsers"])

        db = client[settings.mongodb_database]

        print("DATABASE:", settings.mongodb_database)

        count = await db.cases.count_documents({})
        print("CASES:", count)

    finally:
        await client.close()


asyncio.run(main())