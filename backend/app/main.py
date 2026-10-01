from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models.base import Base
from app.routers import projects, snapshots, chat
from app.ws.endpoint import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev only — use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Ghost AI", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(projects.router)
app.include_router(snapshots.router)
app.include_router(chat.router)

# WebSocket router
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
