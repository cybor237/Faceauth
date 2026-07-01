# FaceAuth Web SDK

SDK JavaScript/TypeScript — Authentification biométrique avec détection de vivacité (Liveness Detection).

## Installation locale (développement)

```bash
cd sdk
npm install
npm run build
```

Cela génère `dist/faceauth.js` (script classique) et `dist/faceauth.esm.js` (import ESM).

## Développement avec rechargement automatique

```bash
npm run dev
```

Reconstruit le bundle à chaque modification de `src/`.

## Tester contre le backend local

1. Assurez-vous que le backend tourne sur `http://localhost:8000` (voir `backend/README.md`)
2. Construisez le SDK : `npm run build`
3. Ouvrez `examples/vanilla/index.html` dans un navigateur (via un serveur local, pas `file://` — la caméra l'exige)

```bash
# Depuis sdk/, lancer un serveur statique simple
npx serve examples/vanilla
# ou
python -m http.server 5500 --directory examples/vanilla
```

Puis ouvrez `http://localhost:5500`, collez une clé API générée depuis votre backend, et testez Enrôler / Vérifier.

> **Important** : `getUserMedia` (accès caméra) exige HTTPS ou `localhost` — ça ne fonctionnera pas en ouvrant le fichier HTML directement (`file://`).

## Usage dans une application

### Via script classique

```html
<script src="https://cdn.faceauth.dev/v1/faceauth.js"></script>
<script>
  const faceauth = new FaceAuth.FaceAuth({
    apiKey: "sk_live_xxxxxxxxxxxx",
    apiBaseUrl: "https://api.faceauth.dev", // ou votre URL Railway
    assetsBaseUrl: "https://api.faceauth.dev", // optionnel : sons SDK auto-hébergés
  });

  async function verifyUser() {
    const result = await faceauth.verify({ endUserId: "user_123" });

    if (result.success) {
      console.log("Vérifié !", result.confidence);
    } else {
      console.error("Échec :", result.errorCode, result.message);
    }
  }
</script>
```

### Via import ESM (React, Vue, etc.)

```ts
import { FaceAuth } from "@faceauth/sdk";

const faceauth = new FaceAuth({
  apiKey: process.env.NEXT_PUBLIC_FACEAUTH_KEY!,
  apiBaseUrl: "https://api.faceauth.dev",
  theme: "auto", // 'light' | 'dark' | 'auto'
  locale: "fr", // 'fr' | 'en'
  enableSound: true,
});

async function handleSignup(userId: string) {
  const result = await faceauth.enroll({ endUserId: userId });
  if (result.success) {
    // Continuer le flux d'inscription
  }
}
```

## API publique

### `new FaceAuth(config)`

| Option | Type | Requis | Description |
|---|---|---|---|
| `apiKey` | `string` | ✅ | Clé API publique du développeur |
| `apiBaseUrl` | `string` | ❌ | URL du backend (par défaut : production) |
| `theme` | `'light' \| 'dark' \| 'auto'` | ❌ | Thème du module (défaut : `auto`) |
| `locale` | `'fr' \| 'en'` | ❌ | Langue des textes UI (défaut : `fr`) |
| `assetsBaseUrl` | `string` | ❌ | URL publique servant `/sounds/success.mp3` et `/sounds/error.mp3` |
| `enableSound` | `boolean` | ❌ | Active/désactive les sons de feedback (défaut : `true`) |

### `faceauth.enroll({ endUserId, container? })`

Enregistre le visage de référence d'un utilisateur. Affiche le module de scan, guide l'utilisateur à travers les 4 gestes, capture et envoie l'image.

### `faceauth.verify({ endUserId, container? })`

Vérifie l'identité d'un utilisateur déjà enrôlé.

### Résultat retourné

```ts
// Succès
{
  success: true,
  endUserId: string,
  match?: boolean,        // uniquement pour verify()
  confidence?: number,    // uniquement pour verify()
  creditsRemaining: number,
  message: string,
}

// Échec
{
  success: false,
  errorCode: "USER_CANCELLED" | "CAMERA_PERMISSION_DENIED" | "CAMERA_NOT_FOUND"
            | "GESTURE_TIMEOUT" | "NETWORK_ERROR" | "INVALID_API_KEY"
            | "INSUFFICIENT_CREDITS" | "NO_FACE_DETECTED" | "USER_NOT_ENROLLED"
            | "SESSION_ALREADY_USED" | "INVALID_TOKEN" | "UNKNOWN_ERROR",
  message: string,
}
```

## Architecture interne

```
src/
├── FaceAuth.ts          Orchestrateur principal (challenge → gestes → capture → API)
├── api/
│   └── FaceAuthAPI.ts   Client HTTP vers le backend FastAPI
├── core/
│   └── GestureEngine.ts MediaPipe FaceLandmarker — détection des 4 gestes
├── ui/
│   ├── ScanModal.ts     Shadow DOM, modale desktop / bottom-sheet mobile
│   ├── CameraView.ts    Flux caméra, Ghost Overlay, bordures progressives
│   └── styles.ts        CSS (thèmes clair/sombre, responsive)
└── index.ts             Point d'entrée exporté
```

### Comment fonctionne la détection des gestes

Le SDK utilise **MediaPipe FaceLandmarker** (`@mediapipe/tasks-vision`), qui tourne entièrement
dans le navigateur via WebAssembly — aucune image n'est envoyée au serveur pendant cette étape.

- **Clignement des yeux** : blendshape `eyeBlinkLeft` / `eyeBlinkRight`
- **Ouverture de la bouche** : blendshape `jawOpen`
- **Rotation de la tête** : angle de lacet (yaw) extrait de la matrice de transformation faciale

Les gestes doivent être complétés **dans l'ordre exact** renvoyé par `/challenge/init` — un geste
effectué hors séquence est ignoré. Cela correspond au paradigme de sécurité hybride décrit dans
la documentation officielle (Section "Approfondissement — Sécurité anti-spoofing").

### Sécurité

- Le `challenge_token` (JWT signé, 90s) est obtenu côté serveur et n'est jamais généré côté client.
- Une fois les 4 gestes validés, une **seule image** est capturée et envoyée — jamais de flux vidéo.
- L'image est immédiatement détruite côté serveur après extraction de l'embedding (voir backend).
- Le contexte UI est verrouillé pendant le scan (pas de fermeture accidentelle).

## Limitations connues (MVP)

- Les seuils de détection de gestes (`BLINK_THRESHOLD`, `MOUTH_OPEN_THRESHOLD`, `HEAD_YAW_THRESHOLD_DEG`
  dans `GestureEngine.ts`) sont des valeurs de départ — à ajuster après tests sur appareils réels,
  particulièrement sur smartphones bas de gamme (voir documentation officielle, risques techniques).
- Pas encore de détection anti-spoofing passive côté client (écran/impression) — prévue post-MVP.
- Le SDK charge le modèle MediaPipe (~ quelques Mo) depuis un CDN Google au premier appel — prévoir
  un indicateur de chargement supplémentaire si nécessaire pour les connexions lentes.
