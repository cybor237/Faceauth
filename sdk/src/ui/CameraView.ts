/**
 * CameraView — gère le flux vidéo de la caméra, le silhouette guide
 * ("Ghost Overlay"), et les 4 bordures progressives correspondant
 * aux 4 gestes de liveness.
 */

import type { GestureType } from "../types";

const BORDER_FOR_GESTURE: Record<GestureType, "top" | "right" | "bottom" | "left"> = {
  blink: "top",
  mouth: "right",
  head_left: "bottom",
  head_right: "left",
};

export class CameraView {
  readonly element: HTMLDivElement;
  readonly videoElement: HTMLVideoElement;

  private stream: MediaStream | null = null;
  private borders: Record<"top" | "right" | "bottom" | "left", HTMLDivElement>;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "fa-camera-wrapper";

    this.videoElement = document.createElement("video");
    this.videoElement.className = "fa-video";
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    const ghostOverlay = this.buildGhostOverlay();

    this.borders = {
      top: this.buildBorder("top"),
      right: this.buildBorder("right"),
      bottom: this.buildBorder("bottom"),
      left: this.buildBorder("left"),
    };

    this.element.append(
      this.videoElement,
      ghostOverlay,
      this.borders.top,
      this.borders.right,
      this.borders.bottom,
      this.borders.left
    );
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
    const side = BORDER_FOR_GESTURE[gesture];
    this.borders[side].classList.add("fa-active");
  }

  /** Réinitialise toutes les bordures (nouvelle session). */
  resetBorders(): void {
    Object.values(this.borders).forEach((b) => b.classList.remove("fa-active"));
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

  private buildGhostOverlay(): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.className = "fa-ghost-overlay";
    wrapper.innerHTML = `
      <svg class="fa-ghost-svg" viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="100" cy="100" rx="70" ry="90" stroke="white" stroke-width="3" stroke-dasharray="8 8"/>
        <path d="M40 200 Q100 240 160 200" stroke="white" stroke-width="3" stroke-dasharray="8 8" fill="none"/>
      </svg>
    `;
    return wrapper;
  }

  private buildBorder(side: "top" | "right" | "bottom" | "left"): HTMLDivElement {
    const el = document.createElement("div");
    el.className = `fa-border fa-border-${side}`;
    return el;
  }
}
