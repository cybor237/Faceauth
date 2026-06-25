# FaceAuth Dashboard — Guide d'intégration

## 1. Installer les dépendances frontend

```bash
cd dashboard
npm install
```

## 2. Configurer Firebase

### Créer un projet Firebase
1. Aller sur console.firebase.google.com
2. Créer un nouveau projet (ou réutiliser l'existant)
3. Ajouter une application Web
4. Copier la config SDK

### Activer les providers d'authentification
Dans Firebase Console → Authentication → Sign-in methods :
- Activer **Google**
- Activer **GitHub** (nécessite un OAuth App GitHub : github.com/settings/developers)

### Configurer le .env
```bash
cp .env.example .env
# Remplir avec vos valeurs Firebase
```

## 3. Configurer le backend (firebase-admin)

### Installer firebase-admin
```bash
cd backend
venv\Scripts\activate
pip install firebase-admin
```

Ajouter dans `backend/requirements.txt` :
```
firebase-admin==6.5.0
```

### Générer une clé de service Firebase
1. Firebase Console → Paramètres du projet → Comptes de service
2. Cliquer "Générer une nouvelle clé privée"
3. Télécharger le fichier JSON (ex: faceauth-service-account.json)
4. Placer le fichier dans `backend/` (ne jamais le committer !)

Ajouter dans `backend/.env` :
```env
GOOGLE_APPLICATION_CREDENTIALS=./faceauth-service-account.json
```

Ajouter dans `backend/.gitignore` :
```
*service-account*.json
*-firebase-*.json
```

### Copier les fichiers backend dans le bon dossier

```bash
# Depuis la racine Faceauth/
copy dashboard\backend_dashboard_router.py backend\app\middleware\firebase_auth.py
copy dashboard\backend_router_dashboard.py backend\app\routers\dashboard.py
```

Puis supprimer les copies temporaires du dossier dashboard :
```bash
del dashboard\backend_dashboard_router.py
del dashboard\backend_router_dashboard.py
```

### Mettre à jour backend/app/main.py
Ajouter après les autres imports de routers :
```python
from app.routers import dashboard
```

Ajouter après les autres app.include_router() :
```python
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
```

### Mettre à jour backend/app/main.py — CORS
Ajouter l'URL du dashboard dans ALLOWED_ORIGINS dans .env :
```env
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

## 4. Lancer le dashboard en développement

```bash
cd dashboard
npm run dev
```

Ouvrir http://localhost:5173

## 5. Structure finale du projet

```
Faceauth/
├── backend/
│   ├── app/
│   │   ├── middleware/
│   │   │   ├── api_key_auth.py    (existant)
│   │   │   └── firebase_auth.py   (nouveau)
│   │   └── routers/
│   │       ├── dashboard.py       (nouveau)
│   │       └── ...
│   ├── faceauth-service-account.json  (ne pas committer)
│   └── .env
├── sdk/
├── dashboard/
│   ├── src/
│   └── .env
└── docs/
```

## Notes importantes

- **Double authentification** : le SDK utilise des clés `sk_live_...` (dans Authorization header),
  le dashboard utilise des Firebase ID tokens (aussi dans Authorization header).
  Les deux routes sont séparées et indépendantes.

- **Premier login** : à la première connexion Firebase, un compte développeur est
  automatiquement créé en base avec 500 crédits de bienvenue.
  Pour ajouter des crédits manuellement en dev, utiliser `scripts/create_test_key.py`.
