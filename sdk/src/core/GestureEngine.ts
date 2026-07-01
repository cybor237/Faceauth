/**
 * GestureEngine — Détection de vivacité (liveness) côté client.
 * v2 — Quality Gate intégré (4 checks avant envoi au serveur).
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { GestureType } from "../types";

const BLINK_THRESHOLD       = 0.5;
const MOUTH_OPEN_THRESHOLD  = 0.4;
const HEAD_YAW_THRESHOLD_DEG = 20;

// Quality Gate — seuils
const QG_MIN_BRIGHTNESS     = 40;   // Moyenne pixels > 40/255
const QG_MAX_BRIGHTNESS     = 220;  // Pas surexposé
const QG_MIN_BLUR_VARIANCE  = 80;   // Variance Laplacian > 80
const QG_MIN_FACE_RATIO     = 0.15; // Visage > 15% de la largeur vidéo
const QG_MAX_FACE_RATIO     = 0.90; // Visage < 90% de la largeur vidéo
const QG_MIN_EYE_OPENNESS   = 0.2;  // Yeux suffisamment ouverts

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export interface QualityCheckResult {
  pass: boolean;
  message?: string;
  code?: string;
}

export type GestureEventCallback = (gesture: GestureType) => void;
export type NoFaceCallback = (visible: boolean) => void;

export class GestureEngine {
  private landmarker:  FaceLandmarker | null = null;
  private videoEl:     HTMLVideoElement;
  private rafId:       number | null = null;
  private running      = false;
  private lastResult:  FaceLandmarkerResult | null = null;  // Dernier résultat MediaPipe

  private gestureLocks: Record<GestureType, boolean> = {
    blink: false, mouth: false, head_left: false, head_right: false,
  };

  private onGestureDetected:     GestureEventCallback;
  private onFaceVisibilityChange?: NoFaceCallback;
  private lastFaceVisible = true;

  constructor(
    videoEl: HTMLVideoElement,
    onGestureDetected: GestureEventCallback,
    onFaceVisibilityChange?: NoFaceCallback
  ) {
    this.videoEl              = videoEl;
    this.onGestureDetected    = onGestureDetected;
    this.onFaceVisibilityChange = onFaceVisibilityChange;
  }

  async initialize(): Promise<void> {
    const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
  }

  start(): void {
    if (!this.landmarker) throw new Error("GestureEngine non initialisé");
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  // ----------------------------------------------------------------
  // QUALITY GATE — 4 checks avant envoi au serveur
  // ----------------------------------------------------------------

  runQualityGate(): QualityCheckResult {
    // Check 1 — Visage présent dans le dernier résultat MediaPipe
    if (!this.lastResult || this.lastResult.faceLandmarks.length === 0) {
      return { pass: false, message: "Visage non détecté — repositionnez-vous", code: "NO_FACE" };
    }

    const landmarks   = this.lastResult.faceLandmarks[0];
    const blendshapes = this.lastResult.faceBlendshapes?.[0]?.categories ?? [];

    // Check 2 — Taille du visage (ratio vs largeur vidéo)
    const faceCheck = this.checkFaceSize(landmarks);
    if (!faceCheck.pass) return faceCheck;

    // Check 3 — Yeux ouverts (via blendshapes)
    const eyeCheck = this.checkEyesOpen(blendshapes);
    if (!eyeCheck.pass) return eyeCheck;

    // Check 4 — Luminosité et flou (via canvas)
    const imgCheck = this.checkImageQuality();
    if (!imgCheck.pass) return imgCheck;

    return { pass: true };
  }

  private checkFaceSize(landmarks: { x: number; y: number }[]): QualityCheckResult {
    const xs = landmarks.map(l => l.x);
    const faceWidth = Math.max(...xs) - Math.min(...xs); // Ratio 0-1

    if (faceWidth < QG_MIN_FACE_RATIO) {
      return { pass: false, message: "Approchez-vous de la caméra", code: "FACE_TOO_SMALL" };
    }
    if (faceWidth > QG_MAX_FACE_RATIO) {
      return { pass: false, message: "Reculez un peu", code: "FACE_TOO_LARGE" };
    }
    return { pass: true };
  }

  private checkEyesOpen(blendshapes: { categoryName: string; score: number }[]): QualityCheckResult {
    const blinkLeft  = blendshapes.find(c => c.categoryName === "eyeBlinkLeft")?.score  ?? 0;
    const blinkRight = blendshapes.find(c => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    const blinkAvg   = (blinkLeft + blinkRight) / 2;

    // Score de clignotement élevé = yeux fermés
    if (blinkAvg > (1 - QG_MIN_EYE_OPENNESS)) {
      return { pass: false, message: "Ouvrez les yeux", code: "EYES_CLOSED" };
    }
    return { pass: true };
  }

  private checkImageQuality(): QualityCheckResult {
    try {
      // Capture une frame réduite pour l'analyse (64x64 suffit)
      const canvas = document.createElement("canvas");
      canvas.width  = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(this.videoEl, 0, 0, 64, 64);
      const imageData = ctx.getImageData(0, 0, 64, 64);
      const data      = imageData.data;

      // --- Luminosité moyenne ---
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      if (avgBrightness < QG_MIN_BRIGHTNESS) {
        return { pass: false, message: "Environnement trop sombre — allumez une lumière", code: "TOO_DARK" };
      }
      if (avgBrightness > QG_MAX_BRIGHTNESS) {
        return { pass: false, message: "Trop de lumière — évitez la lumière directe", code: "TOO_BRIGHT" };
      }

      // --- Flou (variance du Laplacian simplifié) ---
      const grayPixels: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        grayPixels.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }

      let laplacianSum   = 0;
      let laplacianSumSq = 0;
      const w = 64;
      let count = 0;

      for (let y = 1; y < 63; y++) {
        for (let x = 1; x < 63; x++) {
          const idx      = y * w + x;
          const laplacian = Math.abs(
            grayPixels[idx - w] + grayPixels[idx + w] +
            grayPixels[idx - 1] + grayPixels[idx + 1] -
            4 * grayPixels[idx]
          );
          laplacianSum   += laplacian;
          laplacianSumSq += laplacian * laplacian;
          count++;
        }
      }

      const mean     = laplacianSum / count;
      const variance = (laplacianSumSq / count) - (mean * mean);

      if (variance < QG_MIN_BLUR_VARIANCE) {
        return { pass: false, message: "Image floue — restez immobile", code: "BLURRY" };
      }

      return { pass: true };

    } catch {
      // En cas d'erreur canvas (ex: cross-origin) — on laisse passer
      return { pass: true };
    }
  }

  // ----------------------------------------------------------------
  // Boucle de détection
  // ----------------------------------------------------------------
  private loop = (): void => {
    if (!this.running || !this.landmarker) return;

    if (this.videoEl.readyState >= 2) {
      const result    = this.landmarker.detectForVideo(this.videoEl, performance.now());
      this.lastResult = result; // Sauvegarde pour le Quality Gate
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

    if (!faceVisible) { this.resetLocks(); return; }

    this.detectBlink(result);
    this.detectMouthOpen(result);
    this.detectHeadTurn(result);
  }

  private detectBlink(result: FaceLandmarkerResult): void {
    const blendshapes = result.faceBlendshapes?.[0]?.categories;
    if (!blendshapes) return;
    const blinkAvg = (
      (blendshapes.find(c => c.categoryName === "eyeBlinkLeft")?.score  ?? 0) +
      (blendshapes.find(c => c.categoryName === "eyeBlinkRight")?.score ?? 0)
    ) / 2;
    this.evaluateGesture("blink", blinkAvg > BLINK_THRESHOLD);
  }

  private detectMouthOpen(result: FaceLandmarkerResult): void {
    const blendshapes = result.faceBlendshapes?.[0]?.categories;
    if (!blendshapes) return;
    const jawOpen = blendshapes.find(c => c.categoryName === "jawOpen")?.score ?? 0;
    this.evaluateGesture("mouth", jawOpen > MOUTH_OPEN_THRESHOLD);
  }

  private detectHeadTurn(result: FaceLandmarkerResult): void {
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    if (!matrix) return;
    const yawRad = Math.asin(Math.max(-1, Math.min(1, -matrix[2])));
    const yawDeg = (yawRad * 180) / Math.PI;
    this.evaluateGesture("head_left",  yawDeg >  HEAD_YAW_THRESHOLD_DEG);
    this.evaluateGesture("head_right", yawDeg < -HEAD_YAW_THRESHOLD_DEG);
  }

  private evaluateGesture(gesture: GestureType, conditionMet: boolean): void {
    if (conditionMet && !this.gestureLocks[gesture]) {
      this.gestureLocks[gesture] = true;
      this.onGestureDetected(gesture);
    } else if (!conditionMet && this.gestureLocks[gesture]) {
      this.gestureLocks[gesture] = false;
    }
  }

  private resetLocks(): void {
    (Object.keys(this.gestureLocks) as GestureType[]).forEach(g => {
      this.gestureLocks[g] = false;
    });
  }
}