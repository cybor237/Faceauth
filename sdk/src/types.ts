/**
 * Types publics et internes du SDK FaceAuth.
 */

// ============================================================
// Configuration du SDK
// ============================================================

export interface FaceAuthConfig {
  /** Clé API publique du développeur (jamais la clé secrète sk_live_...) */
  apiKey: string;
  /** URL de base de l'API FaceAuth (par défaut : production) */
  apiBaseUrl?: string;
  /** Thème forcé. Par défaut : détection automatique du système. */
  theme?: "light" | "dark" | "auto";
  /** Langue des textes affichés dans le module de scan. */
  locale?: "fr" | "en";
  /** URL publique optionnelle pour charger les assets SDK auto-hébergés. */
  assetsBaseUrl?: string;
  /** Active les sons de feedback. Défaut : true. */
  enableSound?: boolean;
}

// ============================================================
// Gestes de liveness
// ============================================================

export type GestureType = "blink" | "mouth" | "head_left" | "head_right";

export interface GestureProgress {
  gesture: GestureType;
  completed: boolean;
}

// ============================================================
// Résultats retournés au développeur
// ============================================================

export interface FaceAuthSuccessResult {
  success: true;
  endUserId: string;
  /** Présent uniquement pour verify() */
  match?: boolean;
  /** Présent uniquement pour verify() */
  confidence?: number;
  creditsRemaining: number;
  message: string;
}

export interface FaceAuthErrorResult {
  success: false;
  errorCode: FaceAuthErrorCode;
  message: string;
}

export type FaceAuthResult = FaceAuthSuccessResult | FaceAuthErrorResult;

export type FaceAuthErrorCode =
  | "USER_CANCELLED"        // L'utilisateur a cliqué sur "Annuler"
  | "CAMERA_PERMISSION_DENIED"
  | "CAMERA_NOT_FOUND"
  | "GESTURE_TIMEOUT"       // Le défi gestuel n'a pas été complété à temps
  | "NETWORK_ERROR"
  | "INVALID_API_KEY"
  | "INSUFFICIENT_CREDITS"
  | "NO_FACE_DETECTED"
  | "USER_NOT_ENROLLED"
  | "SESSION_ALREADY_USED"
  | "INVALID_TOKEN"
  | "UNKNOWN_ERROR";

// ============================================================
// Options d'appel
// ============================================================

export interface FaceAuthActionOptions {
  /** Identifiant de l'utilisateur final côté application cliente */
  endUserId: string;
  /** Élément DOM dans lequel monter le module (par défaut : document.body) */
  container?: HTMLElement;
}

export interface LivenessGestureEvent {
  gesture: GestureType;
  elapsed_ms: number;
}

export interface LivenessAttestation {
  sequence: GestureType[];
  events: LivenessGestureEvent[];
  started_at: string;
  completed_at: string;
  total_duration_ms: number;
  min_step_duration_ms: number;
  sdk_version: string;
  user_agent: string;
}

// ============================================================
// Réponses internes de l'API backend
// ============================================================

export interface ChallengeInitResponse {
  success: true;
  session_id: string;
  challenge_token: string;
  gestures: GestureType[];
  gesture_labels: string[];
  expires_at: string;
  expires_in: number;
}

export interface VerifyAPIResponse {
  success: true;
  end_user_id: string;
  match: boolean;
  confidence: number;
  threshold: number;
  credits_remaining: number;
  message: string;
}

export interface EnrollAPIResponse {
  success: true;
  end_user_id: string;
  message: string;
  credits_remaining: number;
}

export interface APIErrorResponse {
  success: false;
  error_code?: string;
  detail?: { error_code: string; message: string } | string;
  message?: string;
}
