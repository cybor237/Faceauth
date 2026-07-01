from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Base de données
    DATABASE_URL: str
    #google services
    GOOGLE_APPLICATION_CREDENTIALS: str 
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    

    # JWT / Challenge tokens
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    CHALLENGE_TOKEN_EXPIRE_SECONDS: int = 90

    # DeepFace
    DEEPFACE_MODEL: str = "Facenet512"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5500"]

    # Seuil de similarité (cosinus) pour valider une correspondance
    SIMILARITY_THRESHOLD: float = 0.80
    # Garde-fous liveness SDK : limite les validations trop rapides/falsifiées
    MIN_LIVENESS_TOTAL_MS: int = 1800
    MIN_LIVENESS_STEP_MS: int = 500
    REQUIRE_LIVENESS_ATTESTATION: bool = True
    # Vérification biométrique stricte : recommandé en production pour réduire les faux positifs
    STRICT_FACE_DETECTION: bool = True
    # Quality gate serveur — volontairement souple pour éviter les biais de luminosité/teint
    MIN_IMAGE_BRIGHTNESS: float = 18.0
    MAX_IMAGE_BRIGHTNESS: float = 245.0
    MIN_IMAGE_BLUR_VARIANCE: float = 8.0

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 30

    # Environnement
    ENVIRONMENT: str = "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
