"""
Middleware — Validation des Firebase ID Tokens pour le Dashboard.

Les développeurs s'authentifient via Firebase (Google/GitHub).
Leurs requêtes portent un ID token Firebase dans le header Authorization.
Ce middleware le vérifie et retourne l'objet Developer correspondant,
en créant automatiquement le compte si c'est la première connexion.
"""

import logging
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.developer import Developer

logger = logging.getLogger(__name__)


def _get_firebase_admin():
    """Importe firebase_admin lazily (évite une erreur au démarrage si non configuré)."""
    try:
        import firebase_admin
        from firebase_admin import auth as firebase_auth, credentials
        import os

        if not firebase_admin._apps:
            # Initialisation avec les credentials du service account
            # Option 1 : fichier JSON (GOOGLE_APPLICATION_CREDENTIALS)
            # Option 2 : variables d'environnement individuelles
            cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path:
                cred = credentials.Certificate(cred_path)
            else:
                # En développement, utiliser les credentials par défaut
                cred = credentials.ApplicationDefault()

            firebase_admin.initialize_app(cred)

        return firebase_auth
    except ImportError:
        raise RuntimeError(
            "firebase-admin n'est pas installé. "
            "Lancez : pip install firebase-admin"
        )


async def get_current_developer(
    authorization: str = Header(..., description="Bearer <firebase_id_token>"),
    db: AsyncSession = Depends(get_db),
) -> Developer:
    """
    Dépendance FastAPI — Valide le Firebase ID token et retourne le Developer.
    Crée automatiquement le compte développeur à la première connexion (auto-enroll).
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_TOKEN_FORMAT",
                    "message": "Format d'autorisation invalide. Attendu : Bearer <token>"}
        )

    id_token = authorization.removeprefix("Bearer ").strip()

    # --- Vérification du token Firebase ---
    try:
        firebase_auth = _get_firebase_admin()
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as e:
        logger.warning(f"Token Firebase invalide : {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_FIREBASE_TOKEN",
                    "message": "Token d'authentification invalide ou expiré"}
        )

    firebase_uid = decoded["uid"]
    email        = decoded.get("email", f"{firebase_uid}@unknown.faceauth")

    # --- Récupérer ou créer le développeur ---
    result = await db.execute(
        select(Developer).where(Developer.firebase_uid == firebase_uid)
    )
    developer = result.scalar_one_or_none()

    if developer is None:
        # Première connexion — création automatique du compte
        developer = Developer(
            email=email,
            firebase_uid=firebase_uid,
        )
        db.add(developer)
        await db.flush()
        logger.info(f"✅ Nouveau développeur créé : {email} (uid={firebase_uid})")

    return developer
