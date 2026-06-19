"""
Script utilitaire — Génère un développeur de test + une clé API.

À exécuter UNE SEULE FOIS pour débloquer les tests manuels du SDK,
en attendant que le Dashboard Développeur (Phase 3) existe.

Usage :
    cd backend
    venv\Scripts\activate
    python scripts/create_test_key.py
"""

import asyncio
import sys
import os

# Permet d'importer le package `app` depuis ce script situé dans scripts/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import AsyncSessionLocal, engine, Base
from app.models.developer import Developer
from app.models.api_key import APIKey
from app.middleware.api_key_auth import generate_api_key


async def main():
    async with AsyncSessionLocal() as db:
        # 1. Créer un développeur de test
        dev = Developer(
            email="test@faceauth.dev",
            firebase_uid="test-firebase-uid-001",
        )
        db.add(dev)
        await db.flush()  # Récupère dev.id sans commit définitif

        # 2. Générer une clé API liée à ce développeur
        raw_key, key_hash, key_prefix = generate_api_key()

        api_key = APIKey(
            developer_id=dev.id,
            key_hash=key_hash,
            key_prefix=key_prefix,
            name="Clé de test SDK",
            credits=500,  # Pack Découverte
        )
        db.add(api_key)

        await db.commit()

        print("=" * 60)
        print("✅  Développeur et clé API créés avec succès")
        print("=" * 60)
        print(f"Email développeur : {dev.email}")
        print(f"Crédits           : {api_key.credits}")
        print()
        print("🔑  CLÉ API (copiez-la maintenant, elle ne sera plus affichée) :")
        print()
        print(f"    {raw_key}")
        print()
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())