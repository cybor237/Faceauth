"""
Router : Enrôlement
POST /enroll — Enregistre l'embedding biométrique d'un utilisateur final

Flux :
1. Valider le challenge_token JWT.
2. Vérifier l'anti-replay (session non déjà utilisée).
3. Extraire l'embedding de l'image (thread pool — CPU-bound).
4. Stocker l'embedding dans pgvector.
5. Mettre en cache Redis.
6. Déduire 1 crédit.
7. Journaliser l'opération (conformité KYC).
8. Confirmer la destruction de l'image.
"""

import asyncio
import logging
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_db
from app.models.api_key import APIKey
from app.models.embedding import BiometricEmbedding
from app.models.audit_log import AuditLog
from app.middleware.api_key_auth import get_api_key
from app.services.biometric import BiometricService
from app.services.token import TokenService
from app.services.cache import CacheService
from app.schemas.challenge import EnrollResponse
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 Mo maximum


@router.post("", response_model=EnrollResponse)
async def enroll(
    request: Request,
    end_user_id: str = Form(..., min_length=1, max_length=255),
    challenge_token: str = Form(...),
    liveness_attestation: str | None = Form(None),
    image: UploadFile = File(..., description="Image JPEG/PNG du visage (224x224 recommandé)"),
    api_key: APIKey = Depends(get_api_key),
    db: AsyncSession = Depends(get_db),
):
    image_received_at = datetime.now(timezone.utc)
    image_destroyed_at = None
    credits_before = api_key.credits

    try:
        # ---------------------------------------------------------
        # 1. Valider le Challenge Token JWT
        # ---------------------------------------------------------
        try:
            token_payload = TokenService.decode_challenge_token(challenge_token)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail={"error_code": "INVALID_TOKEN", "message": str(e)})

        session_id = token_payload["sub"]
        expected_gestures = token_payload.get("gestures", [])

        # ---------------------------------------------------------
        # 1b. Valider l'attestation liveness légère du SDK
        # ---------------------------------------------------------
        if settings.REQUIRE_LIVENESS_ATTESTATION and not liveness_attestation:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail={"error_code": "INVALID_TOKEN", "message": "Attestation liveness manquante"})

        if liveness_attestation:
            try:
                attestation = json.loads(liveness_attestation)
                events = attestation.get("events", [])
                sequence = attestation.get("sequence", [])
                total_ms = int(attestation.get("total_duration_ms", 0))
                elapsed = [int(e.get("elapsed_ms", 0)) for e in events]
                if sequence != expected_gestures or [e.get("gesture") for e in events] != expected_gestures:
                    raise ValueError("Séquence de gestes incohérente")
                if total_ms < settings.MIN_LIVENESS_TOTAL_MS:
                    raise ValueError("Défi gestuel complété trop rapidement")
                if any((b - a) < settings.MIN_LIVENESS_STEP_MS for a, b in zip(elapsed, elapsed[1:])):
                    raise ValueError("Gestes trop rapprochés")
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail={"error_code": "INVALID_TOKEN", "message": f"Attestation liveness invalide : {e}"})

        # ---------------------------------------------------------
        # 2. Vérifier l'anti-replay via Redis
        # ---------------------------------------------------------
        session_fresh = await CacheService.mark_session_used(session_id)
        if not session_fresh:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail={"error_code": "SESSION_ALREADY_USED",
                                        "message": "Cette session a déjà été utilisée. Initiez une nouvelle session."})

        # ---------------------------------------------------------
        # 3. Lire et valider l'image
        # ---------------------------------------------------------
        image_bytes = await image.read()
        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail={"error_code": "IMAGE_TOO_LARGE",
                                        "message": "Image trop volumineuse (max 5 Mo)"})

        # ---------------------------------------------------------
        # 4. Extraire l'embedding (dans un thread pool — CPU-bound)
        # ---------------------------------------------------------
        loop = asyncio.get_event_loop()
        try:
            embedding, image_destroyed_at = await loop.run_in_executor(
                None,
                BiometricService.extract_embedding,
                image_bytes,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail={"error_code": "NO_FACE_DETECTED",
                                        "message": f"Aucun visage détecté : {e}"})
        finally:
            # Libérer les bytes de l'image de la mémoire Python
            del image_bytes

        # ---------------------------------------------------------
        # 5. Stocker l'embedding (INSERT ou UPDATE si déjà existant)
        # ---------------------------------------------------------
        from app.config import settings as cfg
        stmt = (
            pg_insert(BiometricEmbedding)
            .values(
                api_key_id=api_key.id,
                end_user_id=end_user_id,
                embedding=embedding,
                model_used=cfg.DEEPFACE_MODEL,
            )
            .on_conflict_do_update(
                constraint="uq_api_key_user",
                set_={"embedding": embedding, "updated_at": datetime.now(timezone.utc)},
            )
        )
        await db.execute(stmt)

        # ---------------------------------------------------------
        # 6. Mettre à jour le cache Redis
        # ---------------------------------------------------------
        await CacheService.set_embedding(str(api_key.id), end_user_id, embedding)

        # ---------------------------------------------------------
        # 7. Déduire 1 crédit
        # ---------------------------------------------------------
        await db.execute(
            update(APIKey)
            .where(APIKey.id == api_key.id)
            .values(credits=APIKey.credits - 1)
        )
        credits_after = credits_before - 1

        # ---------------------------------------------------------
        # 8. Journal d'audit (conformité KYC)
        # ---------------------------------------------------------
        log = AuditLog(
            api_key_id=api_key.id,
            end_user_id=end_user_id,
            action="enroll",
            success=True,
            session_id=session_id,
            image_received_at=image_received_at,
            image_destroyed_at=image_destroyed_at,
            ip_address=request.client.host if request.client else None,
            credits_before=credits_before,
            credits_after=credits_after,
        )
        db.add(log)

        logger.info(f"✅ Enrôlement réussi — user={end_user_id} | api_key={api_key.key_prefix}")

        return EnrollResponse(
            end_user_id=end_user_id,
            credits_remaining=credits_after,
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"❌ Erreur enrôlement inattendue : {e}", exc_info=True)
        # Journal d'erreur
        log = AuditLog(
            api_key_id=api_key.id,
            end_user_id=end_user_id,
            action="enroll",
            success=False,
            image_received_at=image_received_at,
            image_destroyed_at=image_destroyed_at or datetime.now(timezone.utc),
            ip_address=request.client.host if request.client else None,
            credits_before=credits_before,
            credits_after=credits_before,
            error_code="INTERNAL_ERROR",
        )
        db.add(log)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail={"error_code": "INTERNAL_ERROR", "message": "Erreur interne du serveur"})
