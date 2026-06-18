# FaceAuth Backend

API FastAPI — Biometric as a Service

## Prérequis

- Python 3.11+
- PostgreSQL avec extension `pgvector`
- Redis

## Installation locale

```bash
# 1. Cloner le repo et aller dans le dossier
cd faceauth-backend

# 2. Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, REDIS_URL, JWT_SECRET_KEY)

# 5. Initialiser la base de données
# Option A : via psql
psql $DATABASE_URL -f migrations/init.sql

# Option B : via FastAPI (dev uniquement, auto au démarrage)
# La DB est auto-initialisée si ENVIRONMENT=development

# 6. Lancer le serveur
uvicorn app.main:app --reload
```

## Endpoints

| Méthode | Route | Description | Auth |
|---|---|---|---|
| GET | `/health` | Statut du serveur | Non |
| POST | `/challenge/init` | Initie une session gestuels | Clé API |
| POST | `/enroll` | Enrôle un utilisateur | Clé API |
| POST | `/verify` | Vérifie l'identité | Clé API |
| GET | `/docs` | Swagger UI (dev uniquement) | Non |

## Authentification

Toutes les routes (sauf `/health`) requièrent une clé API dans le header :

```
Authorization: Bearer sk_live_xxxxxxxxxxxx
```

## Flux complet

```
1. POST /challenge/init
   → session_id + challenge_token + gestures[]

2. [SDK client] — L'utilisateur effectue les 4 gestes
   → MediaPipe valide localement
   → Capture d'une image finale

3. POST /verify (ou /enroll)
   Body (multipart/form-data) :
   - end_user_id : ID de l'utilisateur côté client
   - challenge_token : JWT reçu à l'étape 1
   - image : JPEG/PNG du visage (224x224 recommandé)
```

## Déploiement Railway

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Créer le projet
railway init

# Ajouter les services (PostgreSQL + Redis)
railway add postgresql
railway add redis

# Configurer les variables d'environnement
railway variables set JWT_SECRET_KEY=<générer avec secrets.token_hex(32)>
railway variables set DEEPFACE_MODEL=Facenet512
railway variables set ENVIRONMENT=production

# Déployer
railway up
```

## Variables d'environnement

Voir `.env.example` pour la liste complète.

## Structure du projet

```
app/
├── main.py                 # App FastAPI + lifespan
├── config.py               # Variables d'environnement (Pydantic)
├── database.py             # SQLAlchemy async + pgvector
├── models/                 # ORM SQLAlchemy
│   ├── api_key.py
│   ├── embedding.py
│   ├── challenge_session.py
│   └── audit_log.py
├── schemas/                # Schémas Pydantic (requêtes/réponses)
│   └── challenge.py
├── services/               # Logique métier
│   ├── biometric.py        # Wrapper DeepFace
│   ├── token.py            # JWT challenge tokens
│   └── cache.py            # Redis anti-replay + cache embeddings
├── routers/                # Routes API
│   ├── challenge.py        # POST /challenge/init
│   ├── enroll.py           # POST /enroll
│   ├── verify.py           # POST /verify
│   └── health.py           # GET /health
└── middleware/
    └── api_key_auth.py     # Validation clé API + génération
migrations/
└── init.sql                # Schéma PostgreSQL complet
```
