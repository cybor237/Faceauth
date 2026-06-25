"""
Router : Dashboard Développeur
Endpoints utilisés par l'interface React du dashboard FaceAuth.

Authentification : Firebase ID token (pas de clé API SDK).
Toutes les routes sont préfixées par /dashboard (dans main.py).
"""

import secrets
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from passlib.context import CryptContext

from app.database import get_db
from app.models.developer import Developer
from app.models.api_key import APIKey
from app.models.audit_log import AuditLog
from app.middleware.firebase_auth import get_current_developer
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================================
# Schémas Pydantic
# ============================================================

class APIKeyOut(BaseModel):
    id: str
    name: Optional[str]
    key_prefix: str
    is_active: bool
    credits: int
    created_at: str
    last_used_at: Optional[str]

    class Config:
        from_attributes = True


class CreateKeyRequest(BaseModel):
    name: str


class DashboardStats(BaseModel):
    total_verifications: int
    successful_verifications: int
    total_enrollments: int
    total_credits_used: int
    credits_remaining: int
    api_keys_count: int


class AuditLogOut(BaseModel):
    id: str
    end_user_id: Optional[str]
    action: str
    success: bool
    similarity_score: Optional[float]
    credits_before: Optional[int]
    credits_after: Optional[int]
    ip_address: Optional[str]
    created_at: str


# ============================================================
# Helpers
# ============================================================

def _key_to_dict(key: APIKey) -> dict:
    return {
        "id":           str(key.id),
        "name":         key.name,
        "key_prefix":   key.key_prefix,
        "is_active":    key.is_active,
        "credits":      key.credits,
        "created_at":   key.created_at.isoformat(),
        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
    }


def _log_to_dict(log: AuditLog) -> dict:
    return {
        "id":              str(log.id),
        "end_user_id":     log.end_user_id,
        "action":          log.action,
        "success":         log.success,
        "similarity_score": log.similarity_score,
        "credits_before":  log.credits_before,
        "credits_after":   log.credits_after,
        "ip_address":      log.ip_address,
        "created_at":      log.created_at.isoformat(),
    }


# ============================================================
# Routes
# ============================================================

@router.get("/stats")
async def get_stats(
    dev: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Statistiques globales du compte développeur."""
    # Clés actives
    keys_result = await db.execute(
        select(APIKey).where(APIKey.developer_id == dev.id, APIKey.is_active == True)
    )
    active_keys = keys_result.scalars().all()

    credits_remaining = sum(k.credits for k in active_keys)
    keys_count        = len(active_keys)

    # Tous les audit logs de toutes les clés du dev
    all_key_ids = [k.id for k in active_keys]

    # Si aucune clé, retourner des stats vides
    if not all_key_ids:
        return DashboardStats(
            total_verifications=0,
            successful_verifications=0,
            total_enrollments=0,
            total_credits_used=0,
            credits_remaining=credits_remaining,
            api_keys_count=keys_count,
        )

    # Total vérifications
    total_verif = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.api_key_id.in_(all_key_ids),
            AuditLog.action.in_(["verify_success", "verify_failed"]),
        )
    )
    # Succès
    successful = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.api_key_id.in_(all_key_ids),
            AuditLog.action == "verify_success",
        )
    )
    # Enrôlements
    enrollments = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.api_key_id.in_(all_key_ids),
            AuditLog.action == "enroll",
        )
    )
    # Crédits consommés (somme des débits)
    credits_used = await db.execute(
        select(func.coalesce(func.sum(
            AuditLog.credits_before - AuditLog.credits_after
        ), 0)).where(
            AuditLog.api_key_id.in_(all_key_ids),
            AuditLog.success == True,
        )
    )

    return DashboardStats(
        total_verifications=total_verif.scalar() or 0,
        successful_verifications=successful.scalar() or 0,
        total_enrollments=enrollments.scalar() or 0,
        total_credits_used=credits_used.scalar() or 0,
        credits_remaining=credits_remaining,
        api_keys_count=keys_count,
    )


@router.get("/keys")
async def list_keys(
    dev: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Liste toutes les clés API du développeur."""
    result = await db.execute(
        select(APIKey)
        .where(APIKey.developer_id == dev.id)
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return {"keys": [_key_to_dict(k) for k in keys]}


@router.post("/keys", status_code=201)
async def create_key(
    body: CreateKeyRequest,
    dev: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """
    Génère une nouvelle clé API.
    La clé brute (raw_key) n'est retournée qu'une seule fois — jamais stockée.
    """
    token   = secrets.token_urlsafe(24)
    raw_key = f"sk_live_{token}"
    prefix  = raw_key[:16]
    hashed  = pwd_context.hash(raw_key)

    api_key = APIKey(
        developer_id=dev.id,
        key_hash=hashed,
        key_prefix=prefix,
        name=body.name,
        credits=500,  # Pack Découverte offert
    )
    db.add(api_key)
    await db.flush()

    logger.info(f"🔑 Nouvelle clé API créée : {prefix}... pour {dev.email}")

    return {
        "raw_key": raw_key,
        "api_key": _key_to_dict(api_key),
    }


@router.patch("/keys/{key_id}/revoke")
async def revoke_key(
    key_id: str,
    dev: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Révoque une clé API (désactivation irréversible)."""
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == uuid.UUID(key_id),
            APIKey.developer_id == dev.id,
        )
    )
    key = result.scalar_one_or_none()

    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail={"error_code": "KEY_NOT_FOUND", "message": "Clé introuvable"})

    if not key.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail={"error_code": "KEY_ALREADY_REVOKED", "message": "Clé déjà révoquée"})

    await db.execute(
        update(APIKey).where(APIKey.id == key.id).values(is_active=False)
    )

    logger.info(f"🚫 Clé révoquée : {key.key_prefix}... par {dev.email}")
    return {"success": True, "message": "Clé révoquée avec succès"}


@router.get("/logs")
async def get_logs(
    action: Optional[str] = Query(None),
    limit:  int           = Query(20, ge=1, le=100),
    offset: int           = Query(0, ge=0),
    dev: Developer = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    """Journal d'audit paginé — filtrable par type d'action."""
    # Récupérer les IDs des clés du dev
    keys_result = await db.execute(
        select(APIKey.id).where(APIKey.developer_id == dev.id)
    )
    key_ids = [r[0] for r in keys_result.all()]

    if not key_ids:
        return {"logs": [], "total": 0}

    filters = [AuditLog.api_key_id.in_(key_ids)]
    if action:
        filters.append(AuditLog.action == action)

    # Total
    total_result = await db.execute(
        select(func.count(AuditLog.id)).where(*filters)
    )
    total = total_result.scalar() or 0

    # Logs paginés
    logs_result = await db.execute(
        select(AuditLog)
        .where(*filters)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = logs_result.scalars().all()

    return {"logs": [_log_to_dict(l) for l in logs], "total": total}
