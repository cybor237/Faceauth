"""
Script utilitaire — Génère une clé API de test.

Réutilisable : si le développeur de test existe déjà, génère
simplement une nouvelle clé API supplémentaire pour lui.

Usage :
    cd backend
    venv\\Scripts\\activate
    python scripts/create_test_key.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.developer import Developer
from app.models.api_key import APIKey
from app.middleware.api_key_auth import generate_api_key

TEST_EMAIL = "test@faceauth.dev"
TEST_FIREBASE_UID = "test-firebase-uid-001"


async def main():
    async with AsyncSessionLocal() as db:
        # Réutilise le développeur de test s'il existe déjà
        result = await db.execute(select(Developer).where(Developer.email == TEST_EMAIL))
        dev = result.scalar_one_or_none()

        if dev is None:
            dev = Developer(email=TEST_EMAIL, firebase_uid=TEST_FIREBASE_UID)
            db.add(dev)
            await db.flush()
            print(f"✅  Nouveau développeur de test créé : {dev.email}")
        else:
            print(f"ℹ️   Développeur de test existant réutilisé : {dev.email}")

        # Génère toujours une nouvelle clé API
        raw_key, key_hash, key_prefix = generate_api_key()

        api_key = APIKey(
            developer_id=dev.id,
            key_hash=key_hash,
            key_prefix=key_prefix,
            name="Clé de test SDK",
            credits=500,
        )
        db.add(api_key)
        await db.commit()

        print("=" * 60)
        print("🔑  NOUVELLE CLÉ API (copiez-la maintenant) :")
        print()
        print(f"    {raw_key}")
        print()
        print(f"Crédits : {api_key.credits}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())