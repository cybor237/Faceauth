/**
 * Styles CSS du module FaceAuth, injectés dans le Shadow DOM.
 * L'encapsulation garantit qu'aucun style du site hôte ne peut
 * altérer l'apparence du module, et inversement.
 */

export const FACEAUTH_STYLES = `
:host {
  all: initial;
}

* {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* ============================================================
   THÈME — variables CSS, claires par défaut, sombres via [data-theme]
   ============================================================ */
.fa-root {
  --fa-bg: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  --fa-text: #1a1a1a;
  --fa-text-secondary: #6b6b6b;
  --fa-border-idle: #e0e0e0;
  --fa-border-active: #3b82f6; /* Utiliser l'accent pour la progression */
  --fa-accent: #2563eb;
  --fa-accent-soft: rgba(37, 99, 235, 0.12);
  --fa-danger: #ef4444;
  --fa-overlay-bg: rgba(0, 0, 0, 0.55);
  --fa-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.fa-root[data-theme="dark"] {
  --fa-bg: linear-gradient(180deg, #18181b 0%, #09090b 100%);
  --fa-text: #f4f4f5;
  --fa-text-secondary: #a1a1aa;
  --fa-border-idle: #3f3f46;
  --fa-border-active: #60a5fa;
  --fa-accent: #3b82f6;
  --fa-accent-soft: rgba(96, 165, 250, 0.16);
  --fa-danger: #f87171;
  --fa-overlay-bg: rgba(0, 0, 0, 0.7);
  --fa-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

/* ============================================================
   OVERLAY — fond assombri derrière la modale/bottom-sheet
   ============================================================ */
.fa-overlay {
  position: fixed;
  inset: 0;
  background: var(--fa-overlay-bg);
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 250ms ease;
}

.fa-overlay.fa-visible {
  opacity: 1;
}

/* ============================================================
   DESKTOP — modale centrée
   ============================================================ */
.fa-panel {
  background: var(--fa-bg);
  color: var(--fa-text);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: var(--fa-shadow);
  width: 420px;
  max-width: 92vw;
  padding: 28px;
  position: relative;
  transform: scale(0.96);
  opacity: 0;
  transition: transform 250ms ease, opacity 250ms ease;
}

.fa-overlay.fa-visible .fa-panel {
  transform: scale(1);
  opacity: 1;
}

/* ============================================================
   MOBILE — bottom-sheet (≤ 640px)
   ============================================================ */
@media (max-width: 640px) {
  .fa-overlay {
    align-items: flex-end;
  }

  .fa-panel {
    width: 100%;
    max-width: 100%;
    border-radius: 24px 24px 0 0;
    height: 85vh;
    max-height: 85vh;
    transform: translateY(100%);
    opacity: 1;
    display: flex;
    flex-direction: column;
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .fa-overlay.fa-visible .fa-panel {
    transform: translateY(0);
  }

  .fa-camera-wrapper {
    flex: 1;
  }
}

/* ============================================================
   En-tête : bouton Annuler
   ============================================================ */
.fa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.fa-brand-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--fa-accent);
  background: var(--fa-accent-soft);
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.fa-brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--fa-accent);
  box-shadow: 0 0 0 4px var(--fa-accent-soft);
}

.fa-cancel-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(127, 127, 127, 0.10);
  border: none;
  color: var(--fa-text-secondary);
  cursor: pointer;
  padding: 0;
  border-radius: 999px;
  transition: background 150ms ease, transform 150ms ease, color 150ms ease;
}

.fa-cancel-btn svg {
  width: 18px;
  height: 18px;
}

.fa-cancel-btn:hover {
  background: var(--fa-danger);
  color: white;
  transform: scale(1.04);
}

/* ============================================================
   Titre / instructions
   ============================================================ */
.fa-title {
  font-size: 20px;
  font-weight: 750;
  margin: 0 0 6px;
  text-align: center;
  letter-spacing: -0.02em;
}

.fa-subtitle {
  font-size: 14px;
  color: var(--fa-text-secondary);
  text-align: center;
  margin: 0 0 20px;
  min-height: 20px;
}

/* ============================================================
   Zone caméra avec bordures progressives (4 côtés = 4 gestes)
   ============================================================ */
.fa-camera-wrapper {
  position: relative;
  width: 100%;
  max-width: 280px; /* Taille max pour le cercle */
  aspect-ratio: 1 / 1;
  margin: 0 auto; /* Centrer le cercle */
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at center, #18181b 0%, #000 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 45px rgba(0,0,0,0.18);
  -webkit-mask-image: -webkit-radial-gradient(white, black); /* Force le cercle sur Safari */
}

.fa-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

/* L'anneau de progression SVG remplace les anciennes bordures et le ghost overlay */
.fa-progress-ring {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fa-progress-ring-circle {
  transition: stroke-dashoffset 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}

.fa-progress-segment {
  transition: stroke 0.3s ease-in-out;
}

.fa-progress-segment.fa-active {
  stroke: var(--fa-border-active);
  filter: drop-shadow(0 0 7px var(--fa-border-active));
}

/* ============================================================
   Message d'erreur sous le scan
   ============================================================ */
.fa-error-message {
  text-align: center;
  font-size: 13px;
  color: var(--fa-danger);
  margin-top: 12px;
  min-height: 18px;
  line-height: 1.35;
}

.fa-footer-brand {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--fa-border-idle);
  text-align: center;
  color: var(--fa-text-secondary);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fa-footer-brand span {
  display: block;
  margin-top: 3px;
  color: var(--fa-accent);
  font-weight: 700;
  letter-spacing: 0.12em;
}

/* ============================================================
   États : chargement, succès, échec
   ============================================================ */
.fa-status-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  gap: 12px;
}

.fa-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--fa-border-idle);
  border-top-color: var(--fa-accent);
  border-radius: 50%;
  animation: fa-spin 0.8s linear infinite;
}

@keyframes fa-spin {
  to { transform: rotate(360deg); }
}

.fa-status-icon {
  width: 56px;
  height: 56px;
}

/* Animation pour les icônes de succès/échec */
.fa-status-icon .fa-icon-path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: fa-draw-icon 0.7s ease-out forwards;
}

@keyframes fa-draw-icon {
  to {
    stroke-dashoffset: 0;
  }
}


.fa-status-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.fa-status-text {
  font-size: 13px;
  color: var(--fa-text-secondary);
  margin: 0;
}
`;
