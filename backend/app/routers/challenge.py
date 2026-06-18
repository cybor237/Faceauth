"""
Router : Challenge
POST /challenge/init — Initialise une session gestuels sécurisée

Retourne :
- Un session_id unique
- Un JWT signé contenant la séquence aléatoire des 4 gestes
- La séquence avec labels lisibles pour guider le SDK côté client
"""

import random
import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.models.api_key import APIKey
from app.models.challenge_session import ChallengeSession
from app.middleware.api_key_auth import get_api_key
from app.services.token import TokenService
from app.schemas.challenge import (
    ChallengeInitResponse,
    GestureType,
    GESTURE_LABELS,
)
from app.config import settings

router = APIRouter()

ALL_GESTURES: list[GestureType] = ["blink", "mouth", "head_left", "head_right"]


@router.post("/init", response_model=ChallengeInitResponse)
async def init_challenge(
    request: Request,
    api_key: APIKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Initialise une session de défi gestuel.

    - Génère une séquence aléatoire des 4 gestes.
    - Crée un JWT signé à durée de vie courte (90s).
    - Enregistre la session en base pour l'audit et l'anti-replay.

    Le SDK client utilisera la séquence pour guider l'utilisateur,
    puis soumettra le challenge_token avec l'image finale.
    """
    # Mélange aléatoire des gestes (ordre différent à chaque session)
    gestures = ALL_GESTURES.copy()
    random.shuffle(gestures)

    # Génération du session_id et du token JWT
    session_id = str(uuid.uuid4())
    challenge_token, expires_at = TokenService.create_challenge_token(session_id, gestures)

    # Enregistrement de la session en base (pour audit)
    session = ChallengeSession(
        session_id=session_id,
        api_key_id=api_key.id,
        gesture_sequence=",".join(gestures),
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()  # Flush sans commit (le commit est fait par get_db à la fin)

    return ChallengeInitResponse(
        session_id=session_id,
        challenge_token=challenge_token,
        gestures=gestures,
        gesture_labels=[GESTURE_LABELS[g] for g in gestures],
        expires_at=expires_at,
        expires_in=settings.CHALLENGE_TOKEN_EXPIRE_SECONDS,
    )
