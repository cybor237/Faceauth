"""
Router : Vérification biométrique
POST /verify — Compare le visage soumis à l'embedding de référence

Flux :
1. Valider le challenge_token JWT.
2. Vérifier l'anti-replay.
3. Extraire l'embedding de l'image soumise (thread pool).
4. Récupérer l'embedding de référence (Redis → pgvector).
5. Calculer la similarité cosinus.
6. Prendre la décision match/no-match selon le seuil configuré.
7. Déduire 1 crédit (quelle que soit la décision).
8. Journaliser (conformité KYC).
"""

import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.models.api_key import APIKey
from app.models.embedding import BiometricEmbedding
from app.models.audit_log import AuditLog
from app.middleware.api_key_auth import get_api_key
from app.services.biometric import BiometricService
from app.services.token import TokenService
from app.services.cache import CacheService
from app.schemas.challenge import VerifyResponse
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 Mo


@router.post("", response_model=VerifyResponse)
async def verify(
    request: Request,
    end_user_id: str = Form(..., min_length=1, max_length=255),
    challenge_token: str = Form(...),
    image: UploadFile = File(...),
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

        # ---------------------------------------------------------
        # 2. Vérifier l'anti-replay
        # ---------------------------------------------------------
        session_fresh = await CacheService.mark_session_used(session_id)
        if not session_fresh:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail={"error_code": "SESSION_ALREADY_USED",
                                        "message": "Session déjà consommée. Initiez une nouvelle session."})

        # ---------------------------------------------------------
        # 3. Lire l'image
        # ---------------------------------------------------------
        image_bytes = await image.read()
        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail={"error_code": "IMAGE_TOO_LARGE", "message": "Image trop volumineuse"})

        # ---------------------------------------------------------
        # 4. Extraire l'embedding de l'image soumise (thread pool)
        # ---------------------------------------------------------
        loop = asyncio.get_event_loop()
        try:
            submitted_embedding, image_destroyed_at = await loop.run_in_executor(
                None,
                BiometricService.extract_embedding,
                image_bytes,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail={"error_code": "NO_FACE_DETECTED", "message": str(e)})
        finally:
            del image_bytes

        # ---------------------------------------------------------
        # 5. Récupérer l'embedding de référence (Redis → pgvector)
        # ---------------------------------------------------------
        ref_embedding = await CacheService.get_embedding(str(api_key.id), end_user_id)

        if ref_embedding is None:
            # Cache miss → requête pgvector
            result = await db.execute(
                select(BiometricEmbedding).where(
                    BiometricEmbedding.api_key_id == api_key.id,
                    BiometricEmbedding.end_user_id == end_user_id,
                )
            )
            record = result.scalar_one_or_none()

            if record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "USER_NOT_ENROLLED",
                            "message": "Cet utilisateur n'a pas encore été enrôlé"},
                )

            ref_embedding = record.embedding
            # Mettre en cache pour les prochaines vérifications
            await CacheService.set_embedding(str(api_key.id), end_user_id, ref_embedding)

        # ---------------------------------------------------------
        # 6. Calcul de la similarité cosinus et décision
        # ---------------------------------------------------------
        similarity = BiometricService.compute_cosine_similarity(submitted_embedding, ref_embedding)
        match = similarity >= settings.SIMILARITY_THRESHOLD

        # ---------------------------------------------------------
        # 7. Déduire 1 crédit (quelle que soit la décision)
        # ---------------------------------------------------------
        await db.execute(
            update(APIKey)
            .where(APIKey.id == api_key.id)
            .values(credits=APIKey.credits - 1)
        )
        credits_after = credits_before - 1

        # ---------------------------------------------------------
        # 8. Journal d'audit
        # ---------------------------------------------------------
        action = "verify_success" if match else "verify_failed"
        log = AuditLog(
            api_key_id=api_key.id,
            end_user_id=end_user_id,
            action=action,
            success=match,
            similarity_score=round(similarity, 4),
            session_id=session_id,
            image_received_at=image_received_at,
            image_destroyed_at=image_destroyed_at,
            ip_address=request.client.host if request.client else None,
            credits_before=credits_before,
            credits_after=credits_after,
        )
        db.add(log)

        logger.info(
            f"{'✅' if match else '❌'} Vérification — "
            f"user={end_user_id} | score={similarity:.3f} | match={match} | key={api_key.key_prefix}"
        )

        return VerifyResponse(
            end_user_id=end_user_id,
            match=match,
            confidence=round(similarity, 4),
            threshold=settings.SIMILARITY_THRESHOLD,
            credits_remaining=credits_after,
            message="Identité vérifiée avec succès" if match else "Correspondance biométrique insuffisante",
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"❌ Erreur vérification inattendue : {e}", exc_info=True)
        log = AuditLog(
            api_key_id=api_key.id,
            end_user_id=end_user_id,
            action="error",
            success=False,
            image_received_at=image_received_at,
            image_destroyed_at=image_destroyed_at or datetime.now(timezone.utc),
            ip_address=request.client.host if request.client else None,
            error_code="INTERNAL_ERROR",
            credits_before=credits_before,
            credits_after=credits_before,
        )
        db.add(log)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail={"error_code": "INTERNAL_ERROR", "message": "Erreur interne du serveur"})
