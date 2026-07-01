"""
Service biométrique — Wrapper autour de DeepFace.
v2 — ArcFace + sanity check anti-faux positifs.
"""

import io
import logging
import numpy as np
import cv2
from datetime import datetime, timezone
from PIL import Image

logger = logging.getLogger(__name__)

_MODEL_LOADED = False


class BiometricService:

    @staticmethod
    def _validate_image_quality(img_array: np.ndarray) -> None:
        """Rejette les captures trop sombres, surexposées ou floues avant DeepFace."""
        from app.config import settings

        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        brightness = float(np.mean(gray))
        blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        if brightness < settings.MIN_IMAGE_BRIGHTNESS:
            raise ValueError(
                f"Image trop sombre (luminosité={brightness:.1f}, minimum={settings.MIN_IMAGE_BRIGHTNESS:.1f})"
            )
        if brightness > settings.MAX_IMAGE_BRIGHTNESS:
            raise ValueError(
                f"Image surexposée (luminosité={brightness:.1f}, maximum={settings.MAX_IMAGE_BRIGHTNESS:.1f})"
            )
        if blur_variance < settings.MIN_IMAGE_BLUR_VARIANCE:
            raise ValueError(
                f"Image trop floue (netteté={blur_variance:.1f}, minimum={settings.MIN_IMAGE_BLUR_VARIANCE:.1f})"
            )

    @staticmethod
    def preload_model():
        global _MODEL_LOADED
        try:
            from deepface import DeepFace
            from app.config import settings

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
        Extrait l'embedding facial avec ArcFace.
        ArcFace est optimisé pour 112x112 (vs 224x224 pour FaceNet512).
        enforce_detection=True : rejette toute image sans visage détectable.
        """
        from deepface import DeepFace
        from app.config import settings

        img = None
        img_array = None
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img.thumbnail((640, 640), Image.LANCZOS)
            img_array = np.array(img)
            BiometricService._validate_image_quality(img_array)

            result = DeepFace.represent(
                img_path=img_array,
                model_name=settings.DEEPFACE_MODEL,
                enforce_detection=settings.STRICT_FACE_DETECTION,
                detector_backend="opencv",
                align=True,
            )

            if not result:
                raise ValueError("Aucun visage détecté dans l'image")

            embedding = result[0]["embedding"]

            # Sanity check — embedding nul = image vide
            emb_array = np.array(embedding)
            if np.all(emb_array == 0) or np.linalg.norm(emb_array) < 0.01:
                raise ValueError("Embedding invalide — image de mauvaise qualité")

            return embedding, datetime.now(timezone.utc)

        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Impossible d'extraire l'embedding : {e}")

        finally:
            if img_array is not None:
                img_array = None
                del img_array
            if img is not None:
                img.close()
                del img

    @staticmethod
    def compute_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        """
        Similarité cosinus entre deux embeddings ArcFace.
        Retourne un score entre 0 et 1.
        Un score >= 0.68 indique une correspondance (seuil ArcFace recommandé).
        """
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)

        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        similarity = float(np.dot(a, b) / (norm_a * norm_b))

        return max(0.0, min(1.0, similarity))