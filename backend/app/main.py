"""
FaceAuth Backend — Point d'entrée principal

Architecture :
- Lifespan : pré-charge DeepFace en RAM + initialise la DB
- CORS : configuré pour les origines du SDK web
- Rate limiting : slowapi (par IP)
- Routes : /health | /challenge | /enroll | /verify
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import init_db
from app.services.biometric import BiometricService
from app.routers import challenge, enroll, verify, health
from app.routers import dashboard

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Rate Limiter (slowapi)
# -------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# -------------------------------------------------------------------
# Lifespan : initialisation au démarrage
# -------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀  FaceAuth Backend — Démarrage")
    logger.info(f"    Environnement : {settings.ENVIRONMENT}")
    logger.info(f"    Modèle DeepFace : {settings.DEEPFACE_MODEL}")
    logger.info("=" * 60)

    # 1. Pré-charger le modèle DeepFace en RAM
    logger.info("⏳  Chargement du modèle biométrique...")
    BiometricService.preload_model()

    # 2. Initialiser la base de données (tables + extension pgvector)
    logger.info("⏳  Connexion à PostgreSQL...")
    await init_db()

    logger.info("✅  FaceAuth prêt à recevoir des requêtes")
    logger.info("=" * 60)

    yield  # Le serveur tourne ici

    logger.info("🛑  FaceAuth — Arrêt propre")


# -------------------------------------------------------------------
# Application FastAPI
# -------------------------------------------------------------------
app = FastAPI(
    title="FaceAuth API",
    description=(
        "SDK d'authentification biométrique — Biometric as a Service (BaaS)\n\n"
        "Intégrez une détection de vivacité (Liveness Detection) par défis "
        "gestuels en quelques lignes de code."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,  # Swagger désactivé en prod
    redoc_url="/redoc" if not settings.is_production else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST","PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# -------------------------------------------------------------------
# Démo SDK — sert la page de test directement (évite CORS en dev)
# -------------------------------------------------------------------
DEMO_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "sdk", "examples", "vanilla")
if os.path.isdir(DEMO_DIR):
    app.mount("/demo", StaticFiles(directory=DEMO_DIR, html=True), name="demo")
    logger.info(f"📂  Démo SDK montée sur /demo (dossier : {DEMO_DIR})")


# Sons SDK
SOUNDS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "sdk", "examples", "vanilla", "sounds")
if os.path.isdir(SOUNDS_DIR):
    app.mount("/sounds", StaticFiles(directory=SOUNDS_DIR), name="sounds")
    logger.info(f"🔊  Sons montés sur /sounds")

# -------------------------------------------------------------------
# Gestion globale des erreurs
# -------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erreur non gérée : {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error_code": "INTERNAL_ERROR",
                 "message": "Une erreur interne est survenue"},
    )


# -------------------------------------------------------------------
# Routers
# -------------------------------------------------------------------
app.include_router(health.router, tags=["Santé"])
app.include_router(challenge.router, prefix="/challenge", tags=["Challenge"])
app.include_router(enroll.router, prefix="/enroll", tags=["Enrôlement"])
app.include_router(verify.router, prefix="/verify", tags=["Vérification"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])