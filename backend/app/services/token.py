"""
Service de génération et validation des Challenge Tokens JWT.

Chaque token est signé, à durée de vie courte (90s par défaut),
et contient la séquence de gestes ainsi que l'identifiant de session.
Cela empêche d'appeler l'API de vérification sans avoir initié
une vraie session de défi côté serveur.
"""

from datetime import datetime, timezone, timedelta
from typing import List
from jose import JWTError, jwt
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class TokenService:

    @staticmethod
    def create_challenge_token(session_id: str, gestures: List[str]) -> tuple[str, datetime]:
        """
        Génère un JWT signé contenant :
        - l'identifiant de session unique
        - la séquence de gestes attendue
        - l'expiration (90 secondes)

        Retourne : (token_str, expires_at)
        """
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.CHALLENGE_TOKEN_EXPIRE_SECONDS
        )
        payload = {
            "sub":      session_id,
            "gestures": gestures,
            "exp":      expires_at,
            "iat":      datetime.now(timezone.utc),
            "type":     "challenge",
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return token, expires_at

    @staticmethod
    def decode_challenge_token(token: str) -> dict:
        """
        Décode et valide un Challenge Token JWT.
        Lève une ValueError si le token est invalide ou expiré.
        """
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            if payload.get("type") != "challenge":
                raise ValueError("Type de token invalide")
            return payload
        except JWTError as e:
            logger.warning(f"Token JWT invalide : {e}")
            raise ValueError(f"Token invalide ou expiré : {e}")
