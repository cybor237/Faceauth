/**
 * GestureEngine — Détection de vivacité (liveness) côté client.
 *
 * Utilise MediaPipe FaceLandmarker (tasks-vision), qui fournit directement :
 * - des "blendshapes" (eyeBlinkLeft/Right, jawOpen) pour le clignement et l'ouverture de bouche
 * - une matrice de transformation faciale pour estimer la rotation de la tête (yaw)
 *
 * Toute la détection s'exécute localement dans le navigateur (0ms réseau),
 * conformément à l'architecture hybride client/serveur de FaceAuth.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { GestureType } from "../types";

// Seuils de détection — ajustables si trop stricts/permissifs en conditions réelles
const BLINK_THRESHOLD = 0.5;       // blendshape eyeBlink (0 = ouvert, 1 = fermé)
const MOUTH_OPEN_THRESHOLD = 0.4;  // blendshape jawOpen
const HEAD_YAW_THRESHOLD_DEG = 20; // degrés de rotation pour valider gauche/droite

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export type GestureEventCallback = (gesture: GestureType) => void;
export type NoFaceCallback = (visible: boolean) => void;

export class GestureEngine {
  private landmarker: FaceLandmarker | null = null;
  private videoEl: HTMLVideoElement;
  private rafId: number | null = null;
  private running = false;

  // Évite de redéclencher le même geste en continu pendant qu'il reste vrai
  private gestureLocks: Record<GestureType, boolean> = {
    blink: false,
    mouth: false,
    head_left: false,
    head_right: false,
  };

  private onGestureDetected: GestureEventCallback;
  private onFaceVisibilityChange?: NoFaceCallback;
  private lastFaceVisible = true;

  constructor(
    videoEl: HTMLVideoElement,
    onGestureDetected: GestureEventCallback,
    onFaceVisibilityChange?: NoFaceCallback
  ) {
    this.videoEl = videoEl;
    this.onGestureDetected = onGestureDetected;
    this.onFaceVisibilityChange = onFaceVisibilityChange;
  }

  /** Charge le modèle MediaPipe (WASM + poids). À appeler avant start(). */
  async initialize(): Promise<void> {
    const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

    this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
  }

  /** Démarre la boucle de détection en temps réel (requestAnimationFrame). */
  start(): void {
    if (!this.landmarker) {
      throw new Error("GestureEngine non initialisé — appelez initialize() d'abord");
    }
    this.running = true;
    this.loop();
  }

  /** Arrête la boucle de détection et libère les ressources. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Libère définitivement le modèle MediaPipe (à appeler à la fermeture du module). */
  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  // ----------------------------------------------------------------
  // Boucle de détection
  // ----------------------------------------------------------------
  private loop = (): void => {
    if (!this.running || !this.landmarker) return;

    if (this.videoEl.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.videoEl, performance.now());
      this.processResult(result);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private processResult(result: FaceLandmarkerResult): void {
    const faceVisible = result.faceLandmarks.length > 0;

    if (faceVisible !== this.lastFaceVisible) {
      this.lastFaceVisible = faceVisible;
      this.onFaceVisibilityChange?.(faceVisible);
    }

    if (!faceVisible) {
      // Réinitialise les verrous quand le visage disparaît du cadre
      this.resetLocks();
      return;
    }

    this.detectBlink(result);
    this.detectMouthOpen(result);
    this.detectHeadTurn(result);
  }

  // ----------------------------------------------------------------
  // Geste 1 : Clignement des yeux
  // ----------------------------------------------------------------
  private detectBlink(result: FaceLandmarkerResult): void {
    const blendshapes = result.faceBlendshapes?.[0]?.categories;
    if (!blendshapes) return;

    const blinkLeft = blendshapes.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const blinkRight = blendshapes.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    const blinkAvg = (blinkLeft + blinkRight) / 2;

    this.evaluateGesture("blink", blinkAvg > BLINK_THRESHOLD);
  }

  // ----------------------------------------------------------------
  // Geste 2 : Ouverture de la bouche
  // ----------------------------------------------------------------
  private detectMouthOpen(result: FaceLandmarkerResult): void {
    const blendshapes = result.faceBlendshapes?.[0]?.categories;
    if (!blendshapes) return;

    const jawOpen = blendshapes.find((c) => c.categoryName === "jawOpen")?.score ?? 0;
    this.evaluateGesture("mouth", jawOpen > MOUTH_OPEN_THRESHOLD);
  }

  // ----------------------------------------------------------------
  // Gestes 3 et 4 : Rotation de la tête gauche/droite
  // ----------------------------------------------------------------
  private detectHeadTurn(result: FaceLandmarkerResult): void {
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    if (!matrix) return;

    const yawDeg = this.extractYawFromMatrix(matrix);

    // Note : le yaw est positif quand la tête tourne vers la droite de l'utilisateur
    // (donc vers la gauche de l'écran, effet miroir webcam)
    this.evaluateGesture("head_left", yawDeg < -HEAD_YAW_THRESHOLD_DEG);
    this.evaluateGesture("head_right", yawDeg > HEAD_YAW_THRESHOLD_DEG);
  }

  /** Extrait l'angle de lacet (yaw) en degrés depuis une matrice de transformation 4x4. */
  private extractYawFromMatrix(matrix: Float32Array | number[]): number {
    // La matrice est stockée en column-major (format MediaPipe)
    // yaw = asin(-m[2]) approximation standard pour une matrice de rotation 3x3 intégrée dans la 4x4
    const m02 = matrix[2];
    const yawRad = Math.asin(Math.max(-1, Math.min(1, -m02)));
    return (yawRad * 180) / Math.PI;
  }

  // ----------------------------------------------------------------
  // Anti-rebond : déclenche l'événement une seule fois par geste tant
  // que la condition reste vraie, évite les déclenchements multiples.
  // ----------------------------------------------------------------
  private evaluateGesture(gesture: GestureType, conditionMet: boolean): void {
    if (conditionMet && !this.gestureLocks[gesture]) {
      this.gestureLocks[gesture] = true;
      this.onGestureDetected(gesture);
    } else if (!conditionMet && this.gestureLocks[gesture]) {
      // Libère le verrou une fois le geste relâché (retour à la position neutre)
      this.gestureLocks[gesture] = false;
    }
  }

  private resetLocks(): void {
    (Object.keys(this.gestureLocks) as GestureType[]).forEach((g) => {
      this.gestureLocks[g] = false;
    });
  }
}
