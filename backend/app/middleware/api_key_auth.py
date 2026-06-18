"""
Middleware / Dépendance FastAPI — Validation de la clé API.

La clé API est attendue dans le header HTTP :
    Authorization: Bearer sk_live_xxxxxxxxxx

Le flux de validation :
1. Extraire la clé du header.
2. Retrouver l'enregistrement en base via le préfixe (sk_live_XXXX).
3. Comparer le hash bcrypt de la clé complète.
4. Vérifier que la clé est active et que le solde de crédits est > 0.
5. Mettre à jour last_used_at.
6. Injecter l'objet APIKey dans la route.
"""

import secrets
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from passlib.context import CryptContext
from datetime import datetime, timezone

from app.database import get_db
from app.models.api_key import APIKey

bearer_scheme = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def get_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> APIKey:
    """
    Dépendance FastAPI — Valide la clé API et retourne l'objet APIKey.
    À injecter dans les routes protégées : Depends(get_api_key)
    """
    raw_key = credentials.credentials

    # La clé doit commencer par sk_live_ ou sk_test_
    if not (raw_key.startswith("sk_live_") or raw_key.startswith("sk_test_")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_KEY_FORMAT", "message": "Format de clé API invalide"},
        )

    # Le préfixe stocké en base = les 16 premiers caractères (ex: "sk_live_abcd1234")
    key_prefix = raw_key[:16]

    result = await db.execute(
        select(APIKey).where(APIKey.key_prefix == key_prefix)
    )
    api_key = result.scalar_one_or_none()

    if api_key is None or not pwd_context.verify(raw_key, api_key.key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_API_KEY", "message": "Clé API invalide"},
        )

    if not api_key.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "KEY_REVOKED", "message": "Clé API révoquée"},
        )

    if api_key.credits <= 0:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"error_code": "INSUFFICIENT_CREDITS",
                    "message": "Solde de crédits insuffisant. Rechargez votre compte."},
        )

    # Mise à jour de last_used_at (sans bloquer la requête)
    await db.execute(
        update(APIKey)
        .where(APIKey.id == api_key.id)
        .values(last_used_at=datetime.now(timezone.utc))
    )

    return api_key


def generate_api_key() -> tuple[str, str, str]:
    """
    Génère une nouvelle clé API.
    Retourne : (raw_key, key_hash, key_prefix)

    raw_key    → affiché une seule fois au développeur, jamais stocké
    key_hash   → stocké en base (bcrypt)
    key_prefix → affiché dans le dashboard pour identification
    """
    token = secrets.token_urlsafe(24)  # 32 chars URL-safe
    raw_key = f"sk_live_{token}"
    key_prefix = raw_key[:16]  # "sk_live_" + 8 chars
    key_hash = pwd_context.hash(raw_key)
    return raw_key, key_hash, key_prefix
