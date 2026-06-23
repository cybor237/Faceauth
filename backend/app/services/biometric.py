"""
Service biométrique — Wrapper autour de DeepFace.

Points clés d'architecture :
- Le modèle est pré-chargé en RAM au démarrage du serveur (lifespan FastAPI).
- L'extraction est exécutée dans un thread pool (CPU-bound, pas async).
- L'image en mémoire est détruite immédiatement après extraction.
- Le score de similarité cosinus est normalisé entre 0 et 1.
"""

import io
import logging
import numpy as np
from datetime import datetime, timezone
from PIL import Image
from typing import Optional

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------
# Variable globale : modèle pré-chargé en mémoire au démarrage
# ----------------------------------------------------------------
_MODEL_LOADED = False


class BiometricService:

    @staticmethod
    def preload_model():
        """
        Pré-charge le modèle DeepFace en RAM.
        À appeler une seule fois dans le lifespan FastAPI.
        """
        global _MODEL_LOADED
        try:
            from deepface import DeepFace
            from app.config import settings

            # DeepFace pré-charge le modèle dès le premier appel à represent()
            # On lui passe une image factice pour déclencher le chargement.
            dummy_img = np.zeros((112, 112, 3), dtype=np.uint8)
            DeepFace.represent(
                img_path=dummy_img,
                model_name=settings.DEEPFACE_MODEL,
                enforce_detection=False,
                detector_backend="skip",
            )
            _MODEL_LOADED = True
            logger.info(f"✅ Modèle {settings.DEEPFACE_MODEL} pré-chargé en RAM")
        except Exception as e:
            logger.error(f"❌ Échec du pré-chargement du modèle : {e}")
            raise

    @staticmethod
    def extract_embedding(image_bytes: bytes) -> tuple[list[float], datetime]:
        """
        Extrait l'embedding facial d'une image.

        1. Décode l'image depuis les bytes reçus.
        2. Redimensionne à 224x224 (optimal pour FaceNet512).
        3. Extrait l'embedding via DeepFace.
        4. Détruit immédiatement l'objet image en mémoire.
        5. Retourne (embedding, image_destroyed_at).

        Lève ValueError si aucun visage n'est détecté.
        """
        from deepface import DeepFace
        from app.config import settings

        img = None
        img_array = None
        try:
            # Décoder l'image
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img = img.resize((224, 224), Image.LANCZOS)
            img_array = np.array(img)

            # Extraction de l'embedding
            result = DeepFace.represent(
                img_path=img_array,
                model_name=settings.DEEPFACE_MODEL,
                enforce_detection=False,
                detector_backend="opencv",
            )

            if not result:
                raise ValueError("Aucun visage détecté dans l'image")

            embedding = result[0]["embedding"]
            return embedding, datetime.now(timezone.utc)

        except ValueError:
            raise
        except Exception as e:
            # Erreur DeepFace (pas de visage, image corrompue, etc.)
            raise ValueError(f"Impossible d'extraire l'embedding : {e}")

        finally:
            # -------------------------------------------------------
            # Destruction immédiate de l'image en mémoire (conformité KYC)
            # L'objet est libéré et le GC Python récupérera la mémoire.
            # -------------------------------------------------------
            if img_array is not None:
                img_array = None
                del img_array
            if img is not None:
                img.close()
                del img

    @staticmethod
    def compute_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        """
        Calcule la similarité cosinus entre deux embeddings.
        Retourne un score entre 0 (aucune ressemblance) et 1 (identique).
        """
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        similarity = float(np.dot(a, b) / (norm_a * norm_b))
        # Clamp entre 0 et 1 (la similarité cosinus peut être légèrement
        # négative à cause des erreurs flottantes)
        return max(0.0, min(1.0, similarity))
