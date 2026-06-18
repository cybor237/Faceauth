"""
Service Redis — Deux usages :
1. Anti-replay des sessions de défi (blacklist des tokens consommés)
2. Cache des embeddings actifs (évite des requêtes PostgreSQL répétées)
"""

import redis.asyncio as redis
from app.config import settings
import logging
import json

logger = logging.getLogger(__name__)

# Client Redis partagé (connexion lazy)
_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


class CacheService:

    # -------------------------------------------------------
    # Anti-replay : marquer un session_id comme "utilisé"
    # -------------------------------------------------------

    @staticmethod
    async def mark_session_used(session_id: str, ttl_seconds: int = 120) -> bool:
        """
        Tente d'écrire session_id dans Redis avec NX (uniquement si absent).
        Retourne True si l'écriture a réussi (session non encore utilisée).
        Retourne False si la clé existait déjà → replay détecté.
        """
        r = get_redis()
        key = f"faceauth:used_session:{session_id}"
        result = await r.set(key, "1", ex=ttl_seconds, nx=True)
        return result is True  # True = session fraîche, False = replay

    @staticmethod
    async def is_session_used(session_id: str) -> bool:
        r = get_redis()
        key = f"faceauth:used_session:{session_id}"
        return await r.exists(key) == 1

    # -------------------------------------------------------
    # Cache d'embeddings de référence
    # -------------------------------------------------------

    @staticmethod
    async def get_embedding(api_key_id: str, end_user_id: str) -> list | None:
        """Récupère un embedding depuis le cache (évite une requête pgvector)."""
        r = get_redis()
        key = f"faceauth:embedding:{api_key_id}:{end_user_id}"
        raw = await r.get(key)
        if raw:
            return json.loads(raw)
        return None

    @staticmethod
    async def set_embedding(
        api_key_id: str,
        end_user_id: str,
        embedding: list,
        ttl_seconds: int = 3600,  # 1 heure
    ) -> None:
        """Met en cache un embedding après enrôlement ou première vérification."""
        r = get_redis()
        key = f"faceauth:embedding:{api_key_id}:{end_user_id}"
        await r.set(key, json.dumps(embedding), ex=ttl_seconds)

    @staticmethod
    async def invalidate_embedding(api_key_id: str, end_user_id: str) -> None:
        """Invalide le cache après mise à jour de l'embedding."""
        r = get_redis()
        key = f"faceauth:embedding:{api_key_id}:{end_user_id}"
        await r.delete(key)

    # -------------------------------------------------------
    # Santé
    # -------------------------------------------------------

    @staticmethod
    async def ping() -> bool:
        try:
            r = get_redis()
            return await r.ping()
        except Exception as e:
            logger.error(f"Redis indisponible : {e}")
            return False
