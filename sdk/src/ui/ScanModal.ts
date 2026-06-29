/**
 * ScanModal — Orchestre l'interface du module de scan FaceAuth.
 * v2 — Effets sonores intégrés (style Apple Pay)
 */

import { FACEAUTH_STYLES } from "./styles";
import { CameraView } from "./CameraView";
import type { GestureType } from "../types";

const GESTURE_LABELS_FR: Record<GestureType, string> = {
  blink:      "Clignez des yeux",
  mouth:      "Ouvrez la bouche",
  head_left:  "Tournez la tête vers la gauche",
  head_right: "Tournez la tête vers la droite",
};

// ----------------------------------------------------------------
// AudioService — chargement et lecture des sons de feedback
// ----------------------------------------------------------------
class AudioService {
  private static cache: Record<string, AudioBuffer> = {};
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    return this.ctx;
  }

  static async preload(name: string, url: string): Promise<void> {
    try {
      const ctx = this.getContext();
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      this.cache[name] = await ctx.decodeAudioData(arrayBuffer);
    } catch {
      // Échec silencieux — le son est un bonus, pas critique
    }
  }

  static play(name: string, volume = 1.0): void {
    try {
      const buffer = this.cache[name];
      if (!buffer) return;
      const ctx = this.getContext();
      if (ctx.state === "suspended") ctx.resume();
      const source   = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch {
      // Échec silencieux
    }
  }
}

export type ScanModalEvents = {
  onCancel: () => void;
  onReady:  (cameraView: CameraView) => void;
};

export class ScanModal {
  private hostElement:   HTMLDivElement;
  private shadowRoot:    ShadowRoot;
  private overlay!:      HTMLDivElement;
  private panel!:        HTMLDivElement;
  private subtitleEl!:   HTMLParagraphElement;
  private errorEl!:      HTMLDivElement;
  private cameraView:    CameraView;
  private bodyContainer!: HTMLDivElement;
  private contextLocked = false;

  constructor(
    private container: HTMLElement,
    private theme: "light" | "dark" | "auto",
    private events: ScanModalEvents
  ) {
    this.hostElement = document.createElement("div");
    this.shadowRoot  = this.hostElement.attachShadow({ mode: "open" });
    this.cameraView  = new CameraView();

    // Précharger les sons dès l'ouverture du module
    this.preloadSounds();

    this.buildDOM();
    this.container.appendChild(this.hostElement);

    requestAnimationFrame(() => this.overlay.classList.add("fa-visible"));
  }

  // ----------------------------------------------------------------
  // Préchargement des sons depuis /sounds/ (servi par FastAPI)
  // ----------------------------------------------------------------
  private preloadSounds(): void {
    const origin = window.location.origin;
    AudioService.preload("success", `${origin}/sounds/success.mp3`);
    AudioService.preload("error",   `${origin}/sounds/error.mp3`);
  }

  // ----------------------------------------------------------------
  // Construction du DOM dans le Shadow Root
  // ----------------------------------------------------------------
  private buildDOM(): void {
    const styleEl = document.createElement("style");
    styleEl.textContent = FACEAUTH_STYLES;
    this.shadowRoot.appendChild(styleEl);

    this.overlay = document.createElement("div");
    this.overlay.className = "fa-overlay";

    this.panel = document.createElement("div");
    this.panel.className = "fa-root fa-panel";
    this.panel.setAttribute("data-theme", this.resolveTheme());

    const header    = document.createElement("div");
    header.className = "fa-header";
    const cancelBtn = document.createElement("button");
    cancelBtn.className   = "fa-cancel-btn";
    cancelBtn.textContent = "Annuler";
    cancelBtn.addEventListener("click", () => this.events.onCancel());
    header.appendChild(cancelBtn);

    const title = document.createElement("h2");
    title.className   = "fa-title";
    title.textContent = "Vérification d'identité";

    this.subtitleEl = document.createElement("p");
    this.subtitleEl.className   = "fa-subtitle";
    this.subtitleEl.textContent = "Positionnez votre visage dans le cadre";

    this.bodyContainer = document.createElement("div");
    this.bodyContainer.className = "fa-camera-wrapper-container";
    this.bodyContainer.appendChild(this.cameraView.element);

    this.errorEl = document.createElement("div");
    this.errorEl.className = "fa-error-message";

    this.panel.append(header, title, this.subtitleEl, this.bodyContainer, this.errorEl);
    this.overlay.appendChild(this.panel);
    this.shadowRoot.appendChild(this.overlay);

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay && !this.contextLocked) {
        this.events.onCancel();
      }
    });
  }

  private resolveTheme(): "light" | "dark" {
    if (this.theme === "auto") {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark" : "light";
    }
    return this.theme;
  }

  async startCamera(): Promise<void> {
    await this.cameraView.start();
    this.contextLocked = true;
    this.events.onReady(this.cameraView);
  }

  getCameraView(): CameraView { return this.cameraView; }

  setInstruction(gesture: GestureType): void {
    this.subtitleEl.textContent = GESTURE_LABELS_FR[gesture];
  }

  setError(message: string): void   { this.errorEl.textContent = message; }
  clearError(): void                 { this.errorEl.textContent = ""; }

  markGestureComplete(gesture: GestureType): void {
    this.cameraView.markGestureComplete(gesture);
  }

  // ----------------------------------------------------------------
  // Écrans d'état avec effets sonores
  // ----------------------------------------------------------------
  showLoadingScreen(message = "Vérification en cours..."): void {
    this.contextLocked = true;
    this.cameraView.stop();
    this.bodyContainer.innerHTML = `
      <div class="fa-status-screen">
        <div class="fa-spinner"></div>
        <p class="fa-status-text">${message}</p>
      </div>
    `;
    this.subtitleEl.textContent = "";
  }

  showSuccessScreen(message: string, onDone: () => void): void {
    // 🔊 Son de succès
    setTimeout(() => AudioService.play("success", 0.8), 100);

    this.bodyContainer.innerHTML = `
      <div class="fa-status-screen">
        <div class="fa-status-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path class="fa-icon-path" d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline class="fa-icon-path" points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <p class="fa-status-title">Vérifié</p>
        <p class="fa-status-text">${message}</p>
      </div>
    `;
    this.subtitleEl.textContent = "";
    setTimeout(onDone, 1400);
  }

  showErrorScreen(message: string, onDone: () => void): void {
    // 🔊 Son d'échec
    setTimeout(() => AudioService.play("error", 0.7), 100);

    this.bodyContainer.innerHTML = `
      <div class="fa-status-screen">
        <div class="fa-status-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--fa-danger)" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle class="fa-icon-path" cx="12" cy="12" r="10"></circle>
            <line class="fa-icon-path" x1="15" y1="9" x2="9" y2="15"></line>
            <line class="fa-icon-path" x1="9"  y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <p class="fa-status-title">Échec de la vérification</p>
        <p class="fa-status-text">${message}</p>
      </div>
    `;
    this.subtitleEl.textContent = "";
    setTimeout(onDone, 1800);
  }

  close(): void {
    this.cameraView.stop();
    this.overlay.classList.remove("fa-visible");
    setTimeout(() => this.hostElement.remove(), 250);
  }
}