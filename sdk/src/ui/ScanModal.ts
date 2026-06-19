/**
 * ScanModal — Orchestre l'interface du module de scan FaceAuth.
 *
 * Responsabilités :
 * - Encapsulation via Shadow DOM (isolation totale du style)
 * - Comportement adaptatif : modale centrée (desktop) / bottom-sheet (mobile)
 * - Verrouillage de contexte pendant le scan (pas de swipe/click-outside)
 * - Bouton "Annuler"
 * - États : scan en cours → chargement → succès / échec
 */

import { FACEAUTH_STYLES } from "./styles";
import { CameraView } from "./CameraView";
import type { GestureType } from "../types";

const GESTURE_LABELS_FR: Record<GestureType, string> = {
  blink: "Clignez des yeux",
  mouth: "Ouvrez la bouche",
  head_left: "Tournez la tête vers la gauche",
  head_right: "Tournez la tête vers la droite",
};

export type ScanModalEvents = {
  onCancel: () => void;
  onReady: (cameraView: CameraView) => void;
};

export class ScanModal {
  private hostElement: HTMLDivElement;
  private shadowRoot: ShadowRoot;
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private subtitleEl!: HTMLParagraphElement;
  private errorEl!: HTMLDivElement;
  private cameraView: CameraView;
  private bodyContainer!: HTMLDivElement;
  private contextLocked = false;

  constructor(
    private container: HTMLElement,
    private theme: "light" | "dark" | "auto",
    private events: ScanModalEvents
  ) {
    this.hostElement = document.createElement("div");
    this.shadowRoot = this.hostElement.attachShadow({ mode: "open" });
    this.cameraView = new CameraView();

    this.buildDOM();
    this.container.appendChild(this.hostElement);

    // Petite latence pour déclencher la transition CSS d'apparition
    requestAnimationFrame(() => this.overlay.classList.add("fa-visible"));
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

    // -- En-tête : bouton Annuler --
    const header = document.createElement("div");
    header.className = "fa-header";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "fa-cancel-btn";
    cancelBtn.textContent = "Annuler";
    cancelBtn.addEventListener("click", () => this.events.onCancel());
    header.appendChild(cancelBtn);

    // -- Titre + instructions --
    const title = document.createElement("h2");
    title.className = "fa-title";
    title.textContent = "Vérification d'identité";

    this.subtitleEl = document.createElement("p");
    this.subtitleEl.className = "fa-subtitle";
    this.subtitleEl.textContent = "Positionnez votre visage dans le cadre";

    // -- Corps (caméra ou écran de statut) --
    this.bodyContainer = document.createElement("div");
    this.bodyContainer.className = "fa-camera-wrapper-container";
    this.bodyContainer.appendChild(this.cameraView.element);

    // -- Message d'erreur --
    this.errorEl = document.createElement("div");
    this.errorEl.className = "fa-error-message";

    this.panel.append(header, title, this.subtitleEl, this.bodyContainer, this.errorEl);
    this.overlay.appendChild(this.panel);
    this.shadowRoot.appendChild(this.overlay);

    // -- Verrouillage de contexte --
    // Empêche la fermeture accidentelle (click outside / swipe down) pendant le scan
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay && !this.contextLocked) {
        this.events.onCancel();
      }
    });
  }

  private resolveTheme(): "light" | "dark" {
    if (this.theme === "auto") {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return this.theme;
  }

  // ----------------------------------------------------------------
  // Cycle de vie de la caméra
  // ----------------------------------------------------------------
  async startCamera(): Promise<void> {
    await this.cameraView.start();
    this.contextLocked = true; // Verrouille le contexte dès que le scan démarre
    this.events.onReady(this.cameraView);
  }

  getCameraView(): CameraView {
    return this.cameraView;
  }

  // ----------------------------------------------------------------
  // Mises à jour d'instructions pendant le scan
  // ----------------------------------------------------------------
  setInstruction(gesture: GestureType): void {
    this.subtitleEl.textContent = GESTURE_LABELS_FR[gesture];
  }

  setError(message: string): void {
    this.errorEl.textContent = message;
  }

  clearError(): void {
    this.errorEl.textContent = "";
  }

  markGestureComplete(gesture: GestureType): void {
    this.cameraView.markGestureComplete(gesture);
  }

  // ----------------------------------------------------------------
  // Écrans d'état : chargement / succès / échec
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
    this.bodyContainer.innerHTML = `
      <div class="fa-status-screen">
        <div class="fa-status-icon">✅</div>
        <p class="fa-status-title">Vérifié</p>
        <p class="fa-status-text">${message}</p>
      </div>
    `;
    this.subtitleEl.textContent = "";
    setTimeout(onDone, 1400);
  }

  showErrorScreen(message: string, onDone: () => void): void {
    this.bodyContainer.innerHTML = `
      <div class="fa-status-screen">
        <div class="fa-status-icon">❌</div>
        <p class="fa-status-title">Échec de la vérification</p>
        <p class="fa-status-text">${message}</p>
      </div>
    `;
    this.subtitleEl.textContent = "";
    setTimeout(onDone, 1800);
  }

  // ----------------------------------------------------------------
  // Fermeture et nettoyage
  // ----------------------------------------------------------------
  close(): void {
    this.cameraView.stop();
    this.overlay.classList.remove("fa-visible");
    setTimeout(() => {
      this.hostElement.remove();
    }, 250); // Laisse le temps à la transition de fondu de jouer
  }
}
