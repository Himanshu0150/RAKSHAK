from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection

from app.api.routes.health import router as health_router
from app.api.routes.cases import router as cases_router
from app.api.routes.persons import router as persons_router
from app.api.routes.entities import router as entities_router
from app.api.routes.evidence import router as evidence_router
from app.api.routes.cdrs import router as cdrs_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.relationships import router as relationships_router
from app.api.routes.events import router as events_router
from app.api.routes.locations import router as locations_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.devices import router as devices_router
from app.api.routes.phones import router as phones_router
from app.api.routes.aliases import router as aliases_router
from app.api.routes.vehicles import router as vehicles_router
from app.api.routes.accounts import router as accounts_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.search import router as search_router
from app.api.routes.ai import router as ai_router
from app.api.routes.auth import router as auth_router

from app.core.demo_subset import initialize_demo_subset

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await initialize_demo_subset()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="SHERLOCK Investigation Platform API",
    description="Python + FastAPI + PyMongo Async Backend",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(cases_router)

app.include_router(persons_router)
app.include_router(entities_router)
app.include_router(evidence_router)
app.include_router(cdrs_router)
app.include_router(transactions_router)
app.include_router(relationships_router)
app.include_router(events_router)
app.include_router(locations_router)
app.include_router(organizations_router)
app.include_router(devices_router)
app.include_router(phones_router)
app.include_router(aliases_router)
app.include_router(vehicles_router)
app.include_router(accounts_router)
app.include_router(analytics_router)
app.include_router(search_router)
app.include_router(ai_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.backend_port, reload=True)
# Uvicorn reload trigger

