FROM python:3.11-slim

# Dépendances système pour OpenCV et DeepFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les dépendances en premier (cache Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY . .

# Pre-télécharger les poids du modèle DeepFace dans l'image Docker
# (évite le téléchargement au démarrage du conteneur Railway)
RUN python -c "\
from deepface import DeepFace; \
import numpy as np; \
dummy = np.zeros((112,112,3), dtype=np.uint8); \
DeepFace.represent(img_path=dummy, model_name='Facenet512', enforce_detection=False, detector_backend='skip'); \
print('Modèle Facenet512 pré-chargé dans limage Docker')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
