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
  --fa-bg: #ffffff;
  --fa-text: #1a1a1a;
  --fa-text-secondary: #6b6b6b;
  --fa-border-idle: #e0e0e0;
  --fa-border-active: #22c55e;
  --fa-accent: #2563eb;
  --fa-danger: #ef4444;
  --fa-overlay-bg: rgba(0, 0, 0, 0.55);
  --fa-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.fa-root[data-theme="dark"] {
  --fa-bg: #18181b;
  --fa-text: #f4f4f5;
  --fa-text-secondary: #a1a1aa;
  --fa-border-idle: #3f3f46;
  --fa-border-active: #4ade80;
  --fa-accent: #3b82f6;
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
  justify-content: flex-end;
  margin-bottom: 8px;
}

.fa-cancel-btn {
  background: transparent;
  border: none;
  color: var(--fa-text-secondary);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 150ms ease;
}

.fa-cancel-btn:hover {
  background: var(--fa-border-idle);
}

/* ============================================================
   Titre / instructions
   ============================================================ */
.fa-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
  text-align: center;
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
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
}

.fa-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* Effet miroir, plus naturel pour l'utilisateur */
}

.fa-ghost-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fa-ghost-svg {
  width: 60%;
  height: 80%;
  opacity: 0.35;
}

/* Bordures progressives — une par geste, s'allument en vert au fur et à mesure */
.fa-border {
  position: absolute;
  background: var(--fa-border-idle);
  transition: background 200ms ease, box-shadow 200ms ease;
}

.fa-border.fa-active {
  background: var(--fa-border-active);
  box-shadow: 0 0 12px var(--fa-border-active);
}

.fa-border-top    { top: 0; left: 0; right: 0; height: 5px; }
.fa-border-right  { top: 0; right: 0; bottom: 0; width: 5px; }
.fa-border-bottom { bottom: 0; left: 0; right: 0; height: 5px; }
.fa-border-left   { top: 0; left: 0; bottom: 0; width: 5px; }

/* ============================================================
   Message d'erreur sous le scan
   ============================================================ */
.fa-error-message {
  text-align: center;
  font-size: 13px;
  color: var(--fa-danger);
  margin-top: 12px;
  min-height: 18px;
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
  font-size: 40px;
  line-height: 1;
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
