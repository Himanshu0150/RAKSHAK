from fastapi import APIRouter
from app.db.mongodb import get_database

router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("", response_model=dict)
async def health_check():
    try:
        db = get_database()
        if db is not None:
            # Simple ping
            await db.command("ping")
            return {
                "status": "ok",
                "database": "connected"
            }
    except Exception:
        pass

    return {
        "status": "error",
        "database": "disconnected"
    }
