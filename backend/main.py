import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import get_settings
from .core.database import engine, Base
from .models import entities as _entities  # noqa: F401  (register ORM tables)
from .models import rmm_entities as _rmm_entities  # noqa: F401  (register RMM tables)
from .api.v1 import executive, rgm, category, forecasting, supply_chain, commercial, data, rmm, rmm_tpm, rmm_ext

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    Base.metadata.create_all(bind=engine)
    yield
    logger.info("Shutdown complete.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Production-grade Retail & CPG Decision Intelligence Platform API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = settings.api_v1_prefix
app.include_router(executive.router, prefix=PREFIX)
app.include_router(rgm.router, prefix=PREFIX)
app.include_router(category.router, prefix=PREFIX)
app.include_router(forecasting.router, prefix=PREFIX)
app.include_router(supply_chain.router, prefix=PREFIX)
app.include_router(commercial.router, prefix=PREFIX)
app.include_router(data.router, prefix=PREFIX)
app.include_router(rmm.router, prefix=PREFIX)
app.include_router(rmm_tpm.router, prefix=PREFIX)
app.include_router(rmm_ext.router, prefix=PREFIX)


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": settings.app_version}


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "status": "running",
    }
