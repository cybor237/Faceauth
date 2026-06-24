/**
 * CameraView — gère le flux vidéo de la caméra et l'anneau de
 * progression circulaire pour les gestes de vivacité.
 */

import type { GestureType } from "../types";

// L'ordre des segments dans le SVG
const SEGMENT_FOR_GESTURE: Record<GestureType, string> = {
  blink: "fa-segment-1",
  mouth: "fa-segment-2",
  head_left: "fa-segment-3",
  head_right: "fa-segment-4",
};

export class CameraView {
  readonly element: HTMLDivElement;
  readonly videoElement: HTMLVideoElement;

  private stream: MediaStream | null = null;
  private progressSegments: Record<string, SVGPathElement>;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "fa-camera-wrapper";

    this.videoElement = document.createElement("video");
    this.videoElement.className = "fa-video";
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    const { progressRing, segments } = this.buildProgressRing();
    this.progressSegments = segments;

    this.element.append(this.videoElement, progressRing);
  }

  /** Demande l'accès caméra et démarre le flux vidéo. */
  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
    } catch (err) {
      const error = err as DOMException;
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        throw new Error("CAMERA_NOT_FOUND");
      }
      throw new Error("CAMERA_PERMISSION_DENIED");
    }

    this.videoElement.srcObject = this.stream;
    await this.videoElement.play();
  }

  /** Coupe la caméra et libère les ressources — IMPORTANT pour la vie privée. */
  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.videoElement.srcObject = null;
  }

  /** Active la bordure correspondant au geste complété. */
  markGestureComplete(gesture: GestureType): void {
    const segmentId = SEGMENT_FOR_GESTURE[gesture];
    this.progressSegments[segmentId]?.classList.add("fa-active");
  }

  /** Réinitialise toutes les bordures (nouvelle session). */
  resetBorders(): void {
    Object.values(this.progressSegments).forEach((s) => s.classList.remove("fa-active"));
  }

  /**
   * Capture l'image actuelle de la vidéo sous forme de Blob JPEG,
   * redimensionnée à 224x224 (optimal pour DeepFace, réduit la payload réseau).
   */
  async captureFrame(): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d")!;

    // Capturer sans le flip miroir CSS (DeepFace veut l'image naturelle)
    ctx.save();
    ctx.drawImage(this.videoElement, 0, 0, 224, 224);
    ctx.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Échec de capture d'image"))),
        "image/jpeg",
        0.95  // Qualité augmentée de 0.92 → 0.95
      );
    });
}

  private buildProgressRing(): { progressRing: HTMLDivElement; segments: Record<string, SVGPathElement> } {
    const wrapper = document.createElement("div");
    wrapper.className = "fa-progress-ring";

    // SVG avec 4 arcs pour les 4 gestes
    wrapper.innerHTML = `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" stroke="var(--fa-border-idle)" stroke-width="4" opacity="0.5"/>
        <g transform="rotate(-90 50 50)">
          <path id="fa-segment-1" class="fa-progress-segment" d="M 50 4 A 46 46 0 0 1 96 50" stroke="var(--fa-border-idle)" stroke-width="4" />
          <path id="fa-segment-2" class="fa-progress-segment" d="M 96 50 A 46 46 0 0 1 50 96" stroke="var(--fa-border-idle)" stroke-width="4" />
          <path id="fa-segment-3" class="fa-progress-segment" d="M 50 96 A 46 46 0 0 1 4 50" stroke="var(--fa-border-idle)" stroke-width="4" />
          <path id="fa-segment-4" class="fa-progress-segment" d="M 4 50 A 46 46 0 0 1 50 4" stroke="var(--fa-border-idle)" stroke-width="4" />
        </g>
      </svg>
    `;

    const segments = {
      "fa-segment-1": wrapper.querySelector<SVGPathElement>("#fa-segment-1")!,
      "fa-segment-2": wrapper.querySelector<SVGPathElement>("#fa-segment-2")!,
      "fa-segment-3": wrapper.querySelector<SVGPathElement>("#fa-segment-3")!,
      "fa-segment-4": wrapper.querySelector<SVGPathElement>("#fa-segment-4")!,
    };

    return { progressRing: wrapper, segments };
  }
}
