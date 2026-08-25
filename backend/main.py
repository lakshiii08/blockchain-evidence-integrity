"""
FastAPI Main Application for Blockchain Evidence Integrity Subsystem.
"""

from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from dotenv import load_dotenv

load_dotenv()

from backend.database import engine, Base
from backend.api.routes_evidence import router as evidence_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("evidence_integrity")

HTML_PORTAL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "metamask_verifier.html"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schemas ready.")
    yield
    logger.info("Shutting down Evidence Integrity API service.")


app = FastAPI(
    title="Blockchain Evidence Integrity API",
    description=(
        "Production-style API for digital evidence cryptographic hashing (SHA-256), "
        "Polygon Amoy / Ethereum smart contract anchoring, tamper detection, "
        "and immutable provenance trail generation."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(evidence_router)


@app.get("/", response_class=HTMLResponse, tags=["Web Portal"])
@app.get("/metamask", response_class=HTMLResponse, tags=["Web Portal"])
def get_metamask_portal():
    """Serves the standalone MetaMask Web3 Evidence Portal directly from the backend."""
    if os.path.exists(HTML_PORTAL_PATH):
        return FileResponse(HTML_PORTAL_PATH, media_type="text/html")
    return HTMLResponse("<h1>MetaMask portal file not found</h1>", status_code=404)


@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "module": "blockchain-evidence-integrity",
        "version": "1.0.0",
        "description": "Evidence Integrity & Cryptographic Provenance Anchoring"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
