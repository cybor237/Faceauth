from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import datetime


# ==============================================================
# Schémas communs
# ==============================================================

class ErrorResponse(BaseModel):
    success: Literal[False] = False
    error_code: str
    message: str


class SuccessBase(BaseModel):
    success: Literal[True] = True


# ==============================================================
# Challenge — Initialisation de session gestuels
# ==============================================================

GestureType = Literal["blink", "mouth", "head_left", "head_right"]

GESTURE_LABELS = {
    "blink":      "Clignez des yeux",
    "mouth":      "Ouvrez la bouche",
    "head_left":  "Tournez la tête vers la gauche",
    "head_right": "Tournez la tête vers la droite",
}


class ChallengeInitRequest(BaseModel):
    """Corps optionnel — la clé API est dans le header."""
    pass


class ChallengeInitResponse(SuccessBase):
    session_id: str         = Field(..., description="Identifiant unique de la session")
    challenge_token: str    = Field(..., description="JWT signé à durée de vie courte (90s)")
    gestures: List[GestureType] = Field(..., description="Séquence aléatoire des 4 gestes à effectuer")
    gesture_labels: List[str]   = Field(..., description="Labels lisibles dans l'ordre")
    expires_at: datetime    = Field(..., description="Date d'expiration du token")
    expires_in: int         = Field(..., description="Durée de vie en secondes")


# ==============================================================
# Enrôlement — Enregistrer un embedding de référence
# ==============================================================

class EnrollRequest(BaseModel):
    end_user_id: str    = Field(..., min_length=1, max_length=255,
                                description="Identifiant de l'utilisateur final côté client")
    challenge_token: str = Field(..., description="JWT de la session validée côté client")
    # L'image est envoyée en multipart/form-data (UploadFile dans la route)


class EnrollResponse(SuccessBase):
    end_user_id: str
    message: str = "Enrôlement biométrique réussi"
    credits_remaining: int


# ==============================================================
# Vérification — Comparer un visage à l'embedding de référence
# ==============================================================

class VerifyRequest(BaseModel):
    end_user_id: str     = Field(..., min_length=1, max_length=255)
    challenge_token: str = Field(..., description="JWT de la session validée côté client")


class VerifyResponse(SuccessBase):
    end_user_id: str
    match: bool         = Field(..., description="True si le visage correspond à l'embedding de référence")
    confidence: float   = Field(..., ge=0, le=1, description="Score de similarité cosinus (0-1)")
    threshold: float    = Field(..., description="Seuil utilisé pour la décision")
    credits_remaining: int
    message: str
