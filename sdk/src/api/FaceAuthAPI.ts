/**
 * Client HTTP — communique avec le backend FastAPI FaceAuth.
 *
 * Toutes les requêtes incluent la clé API dans le header Authorization.
 * Les erreurs HTTP sont normalisées en FaceAuthErrorCode.
 */

import type {
  ChallengeInitResponse,
  VerifyAPIResponse,
  EnrollAPIResponse,
  APIErrorResponse,
  FaceAuthErrorCode,
} from "../types";

const DEFAULT_API_BASE_URL = "https://api.faceauth.dev";

export class FaceAuthAPIError extends Error {
  code: FaceAuthErrorCode;
  constructor(code: FaceAuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "FaceAuthAPIError";
  }
}

export class FaceAuthAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
  }

  /**
   * POST /challenge/init
   * Initialise une session de défi gestuel et récupère le challenge_token.
   */
  async initChallenge(): Promise<ChallengeInitResponse> {
    const res = await this.request("/challenge/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res as ChallengeInitResponse;
  }

  /**
   * POST /enroll
   * Enregistre l'embedding biométrique de référence d'un utilisateur.
   */
  async enroll(params: {
    endUserId: string;
    challengeToken: string;
    imageBlob: Blob;
  }): Promise<EnrollAPIResponse> {
    const formData = new FormData();
    formData.append("end_user_id", params.endUserId);
    formData.append("challenge_token", params.challengeToken);
    formData.append("image", params.imageBlob, "face.jpg");

    const res = await this.request("/enroll", {
      method: "POST",
      body: formData,
    });
    return res as EnrollAPIResponse;
  }

  /**
   * POST /verify
   * Compare le visage soumis à l'embedding de référence.
   */
  async verify(params: {
    endUserId: string;
    challengeToken: string;
    imageBlob: Blob;
  }): Promise<VerifyAPIResponse> {
    const formData = new FormData();
    formData.append("end_user_id", params.endUserId);
    formData.append("challenge_token", params.challengeToken);
    formData.append("image", params.imageBlob, "face.jpg");

    const res = await this.request("/verify", {
      method: "POST",
      body: formData,
    });
    return res as VerifyAPIResponse;
  }

  // ----------------------------------------------------------------
  // Requête générique avec gestion d'erreurs normalisée
  // ----------------------------------------------------------------
  private async request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
    } catch (err) {
      throw new FaceAuthAPIError(
        "NETWORK_ERROR",
        "Impossible de contacter le serveur FaceAuth. Vérifiez votre connexion."
      );
    }

    if (!response.ok) {
      throw await this.parseErrorResponse(response);
    }

    return response.json();
  }

  private async parseErrorResponse(response: Response): Promise<FaceAuthAPIError> {
    let body: APIErrorResponse | null = null;
    try {
      body = await response.json();
    } catch {
      // Réponse non-JSON (ex: erreur réseau brute)
    }

    // Le backend FastAPI encapsule parfois l'erreur dans `detail`
    let errorCode = "UNKNOWN_ERROR";
    let message = `Erreur HTTP ${response.status}`;

    if (body) {
      if (typeof body.detail === "object" && body.detail !== null) {
        errorCode = body.detail.error_code ?? errorCode;
        message = body.detail.message ?? message;
      } else if (body.error_code) {
        errorCode = body.error_code;
        message = body.message ?? message;
      }
    }

    // Mapping des codes HTTP standards si le backend n'a pas répondu en JSON structuré
    if (response.status === 401) errorCode = errorCode === "UNKNOWN_ERROR" ? "INVALID_API_KEY" : errorCode;
    if (response.status === 402) errorCode = "INSUFFICIENT_CREDITS";
    if (response.status === 404) errorCode = errorCode === "UNKNOWN_ERROR" ? "USER_NOT_ENROLLED" : errorCode;
    if (response.status === 409) errorCode = "SESSION_ALREADY_USED";
    if (response.status === 422) errorCode = errorCode === "UNKNOWN_ERROR" ? "NO_FACE_DETECTED" : errorCode;

    return new FaceAuthAPIError(errorCode as FaceAuthErrorCode, message);
  }
}
