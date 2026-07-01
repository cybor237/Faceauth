/**
 * FaceAuth — Classe principale du SDK.
 *
 * Orchestre le flux complet :
 * 1. challenge/init → récupère la séquence aléatoire des 4 gestes
 * 2. Affiche le module de scan (Shadow DOM, modale/bottom-sheet)
 * 3. Démarre la caméra + le moteur de détection de gestes (MediaPipe)
 * 4. Valide les gestes DANS L'ORDRE de la séquence reçue du serveur
 * 5. Une fois les 4 gestes validés → capture l'image finale
 * 6. Envoie l'image au serveur (enroll ou verify) avec le challenge_token
 * 7. Affiche le résultat et retourne une Promise au développeur
 */

import { FaceAuthAPI, FaceAuthAPIError } from "./api/FaceAuthAPI";
import { GestureEngine } from "./core/GestureEngine";
import { ScanModal } from "./ui/ScanModal";
import type {
  FaceAuthConfig,
  FaceAuthResult,
  FaceAuthActionOptions,
  GestureType,
  FaceAuthErrorCode,
  LivenessAttestation,
  LivenessGestureEvent,
} from "./types";

type ActionMode = "enroll" | "verify";
const SDK_VERSION = "0.1.0";
const MIN_GESTURE_STEP_MS = 600;
const MIN_TOTAL_LIVENESS_MS = 1800;

export class FaceAuth {
  private api: FaceAuthAPI;
  private theme: "light" | "dark" | "auto";
  private locale: "fr" | "en";
  private assetsBaseUrl?: string;
  private enableSound: boolean;

  constructor(config: FaceAuthConfig) {
    if (!config.apiKey) {
      throw new Error("FaceAuth : `apiKey` est requis pour initialiser le SDK");
    }
    this.api = new FaceAuthAPI(config.apiKey, config.apiBaseUrl);
    this.theme = config.theme ?? "auto";
    this.locale = config.locale ?? "fr";
    this.assetsBaseUrl = config.assetsBaseUrl;
    this.enableSound = config.enableSound ?? true;
  }

  /** Enrôle un nouvel utilisateur — enregistre son visage de référence. */
  enroll(options: FaceAuthActionOptions): Promise<FaceAuthResult> {
    return this.runFlow("enroll", options);
  }

  /** Vérifie l'identité d'un utilisateur déjà enrôlé. */
  verify(options: FaceAuthActionOptions): Promise<FaceAuthResult> {
    return this.runFlow("verify", options);
  }

  // ----------------------------------------------------------------
  // Flux principal — partagé entre enroll() et verify()
  // ----------------------------------------------------------------
  private runFlow(mode: ActionMode, options: FaceAuthActionOptions): Promise<FaceAuthResult> {
    return new Promise(async (resolve) => {
      const container = options.container ?? document.body;
      let modal: ScanModal | null = null;
      let gestureEngine: GestureEngine | null = null;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        gestureEngine?.dispose();
      };

      const finish = (result: FaceAuthResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const finishWithError = (code: FaceAuthErrorCode, message: string) => {
        if (modal) {
          modal.showErrorScreen(message, () => {
            modal?.close();
            finish({ success: false, errorCode: code, message });
          });
        } else {
          finish({ success: false, errorCode: code, message });
        }
      };

      try {
        // ------------------------------------------------------
        // 1. Initialiser la session de défi gestuel
        // ------------------------------------------------------
        const challenge = await this.api.initChallenge();

        // ------------------------------------------------------
        // 2. Construire le module UI
        // ------------------------------------------------------
        modal = new ScanModal(container, this.theme, {
          locale: this.locale,
          assetsBaseUrl: this.assetsBaseUrl,
          enableSound: this.enableSound,
          onCancel: () => {
            modal?.close();
            finish({
              success: false,
              errorCode: "USER_CANCELLED",
              message: "Vérification annulée par l'utilisateur",
            });
          },
          onReady: () => {
            /* la caméra est prête — rien à faire de plus ici */
          },
        });

        // ------------------------------------------------------
        // 3. Démarrer la caméra
        // ------------------------------------------------------
        try {
          await modal.startCamera();
        } catch (err) {
          const message =
            (err as Error).message === "CAMERA_NOT_FOUND"
              ? "Aucune caméra détectée sur cet appareil"
              : "Accès à la caméra refusé. Autorisez la caméra pour continuer.";
          const code: FaceAuthErrorCode =
            (err as Error).message === "CAMERA_NOT_FOUND" ? "CAMERA_NOT_FOUND" : "CAMERA_PERMISSION_DENIED";
          modal.close();
          finish({ success: false, errorCode: code, message });
          return;
        }

        // ------------------------------------------------------
        // 4. Timeout global — aligné sur l'expiration du challenge_token
        // ------------------------------------------------------
        timeoutHandle = setTimeout(() => {
          finishWithError(
            "GESTURE_TIMEOUT",
            "Le temps imparti pour la vérification est écoulé. Réessayez."
          );
        }, challenge.expires_in * 1000);

        // ------------------------------------------------------
        // 5. Détection des gestes — DOIT respecter l'ordre de la séquence
        // ------------------------------------------------------
        const sequence: GestureType[] = challenge.gestures;
        let currentIndex = 0;
        const flowStartedAt = new Date();
        const flowStartedMs = performance.now();
        let lastAcceptedMs = 0;
        const livenessEvents: LivenessGestureEvent[] = [];
        modal.setInstruction(sequence[0]);

        const cameraView = modal.getCameraView();

        gestureEngine = new GestureEngine(
          cameraView.videoElement,
          (detectedGesture) => {
            const expected = sequence[currentIndex];
            if (detectedGesture !== expected) return; // Ignore le geste hors séquence

            const now = performance.now();
            if (lastAcceptedMs > 0 && now - lastAcceptedMs < MIN_GESTURE_STEP_MS) {
              return;
            }

            modal?.markGestureComplete(expected);
            modal?.clearError();
            livenessEvents.push({ gesture: expected, elapsed_ms: Math.round(now - flowStartedMs) });
            lastAcceptedMs = now;
            currentIndex += 1;

            if (currentIndex < sequence.length) {
              modal?.setInstruction(sequence[currentIndex]);
            } else {
              // Tous les gestes sont validés → capture et envoi
              void onAllGesturesComplete();
            }
          },
          (faceVisible) => {
            if (!faceVisible) {
              modal?.setError("Visage non détecté — repositionnez-vous dans le cadre");
            } else {
              modal?.clearError();
            }
          }
        );

        await gestureEngine.initialize();
        gestureEngine.start();

        // ------------------------------------------------------
        // 6. Une fois les 4 gestes validés : capturer et envoyer
        // ------------------------------------------------------
        const onAllGesturesComplete = async () => {
          if (settled) return;
          gestureEngine?.stop();
          const completedAt = new Date();
          const totalDurationMs = Math.round(performance.now() - flowStartedMs);
          if (totalDurationMs < MIN_TOTAL_LIVENESS_MS || livenessEvents.length !== sequence.length) {
            modal?.setError("Gestes validés trop rapidement — recommencez calmement");
            currentIndex = 0;
            lastAcceptedMs = 0;
            livenessEvents.length = 0;
            cameraView.resetBorders();
            modal?.setInstruction(sequence[0]);
            gestureEngine?.start();
            return;
          }
           // 🔍 Quality Gate — vérification qualité avant envoi
          const quality = gestureEngine?.runQualityGate();
          if (quality && !quality.pass) {
            modal?.setError(quality.message ?? "Photo de mauvaise qualité — réessayez");
            // Relancer le scan
            gestureEngine?.start();
            return;
          }

          modal?.showLoadingScreen(
            mode === "enroll" ? "Enregistrement en cours..." : "Vérification en cours..."
          );

          try {
            const imageBlob = await cameraView.captureFrame();
            const livenessAttestation: LivenessAttestation = {
              sequence,
              events: livenessEvents,
              started_at: flowStartedAt.toISOString(),
              completed_at: completedAt.toISOString(),
              total_duration_ms: totalDurationMs,
              min_step_duration_ms: MIN_GESTURE_STEP_MS,
              sdk_version: SDK_VERSION,
              user_agent: navigator.userAgent,
            };

            if (mode === "enroll") {
              const res = await this.api.enroll({
                endUserId: options.endUserId,
                challengeToken: challenge.challenge_token,
                imageBlob,
                livenessAttestation,
              });
              modal?.showSuccessScreen("Visage enregistré avec succès", () => {
                modal?.close();
                finish({
                  success: true,
                  endUserId: res.end_user_id,
                  creditsRemaining: res.credits_remaining,
                  message: res.message,
                });
              });
            } else {
              const res = await this.api.verify({
                endUserId: options.endUserId,
                challengeToken: challenge.challenge_token,
                imageBlob,
                livenessAttestation,
              });

              if (res.match) {
                modal?.showSuccessScreen(res.message, () => {
                  modal?.close();
                  finish({
                    success: true,
                    endUserId: res.end_user_id,
                    match: res.match,
                    confidence: res.confidence,
                    creditsRemaining: res.credits_remaining,
                    message: res.message,
                  });
                });
              } else {
                finishWithError("NO_FACE_DETECTED", res.message || "Identité non confirmée");
              }
            }
          } catch (err) {
            const apiErr = err as FaceAuthAPIError;
            finishWithError(
              apiErr.code ?? "UNKNOWN_ERROR",
              apiErr.message ?? "Une erreur est survenue pendant la vérification"
            );
          }
        };
      } catch (err) {
        const apiErr = err as FaceAuthAPIError;
        modal?.close();
        finish({
          success: false,
          errorCode: apiErr.code ?? "UNKNOWN_ERROR",
          message: apiErr.message ?? "Impossible d'initialiser la session de vérification",
        });
      }
    });
  }
}
