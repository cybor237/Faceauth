"""
Router : Health Check
GET /health — Vérification de la disponibilité du serveur

Utilisé pour :
- Le warm-up Railway (éviter les cold starts)
- Le monitoring externe
- La vérification de connectivité depuis le SDK client
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.cache import CacheService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Vérifie la disponibilité de tous les composants critiques :
    - Serveur FastAPI (répondre = ok)
    - PostgreSQL (requête simple)
    - Redis (ping)
    - Modèle DeepFace (variable globale)
    """
    from app.services.biometric import _MODEL_LOADED

    # Test PostgreSQL
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        logger.error(f"PostgreSQL indisponible : {e}")

    # Test Redis
    redis_ok = await CacheService.ping()

    status = "healthy" if (db_ok and redis_ok and _MODEL_LOADED) else "degraded"

    return {
        "status": status,
        "components": {
            "api":         "up",
            "database":    "up" if db_ok else "down",
            "cache":       "up" if redis_ok else "down",
            "deepface_model": "loaded" if _MODEL_LOADED else "not_loaded",
        },
    }
