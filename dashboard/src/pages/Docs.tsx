import { useState } from "react";
import { TopBar } from "../components/Layout/TopBar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

const SECTIONS = ["Démarrage rapide", "Enrôlement", "Vérification", "Erreurs", "Sécurité"];

export function Docs() {
  const [active, setActive] = useState("Démarrage rapide");

  return (
    <div className="page-enter" style={{ flex: 1, overflow: "auto" }}>
      <TopBar title="Documentation" subtitle="Guide d'intégration du SDK FaceAuth" />
      <div style={{ padding: "28px", display: "flex", gap: "24px", alignItems: "flex-start" }}>

        {/* Nav latérale */}
        <div style={{
          width: 180, flexShrink: 0,
          position: "sticky", top: "28px",
        }}>
          <Card padding="8px">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActive(s)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: active === s ? "var(--blue-faint)" : "transparent",
                  color: active === s ? "var(--blue-dark)" : "var(--gray-600)",
                  fontWeight: active === s ? 600 : 400,
                  fontSize: "13px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 150ms ease",
                  marginBottom: "2px",
                }}
              >
                {s}
              </button>
            ))}
          </Card>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {active === "Démarrage rapide" && <QuickStart />}
          {active === "Enrôlement"       && <EnrollDocs />}
          {active === "Vérification"     && <VerifyDocs />}
          {active === "Erreurs"          && <ErrorDocs />}
          {active === "Sécurité"         && <SecurityDocs />}
        </div>
      </div>
    </div>
  );
}

// --- Sections de documentation ---

function QuickStart() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <DocSection title="Démarrage rapide" badge="5 minutes">
        <p>Intégrez FaceAuth en 3 étapes dans n'importe quelle application web.</p>

        <Step n={1} title="Inclure le SDK">
          <Code>{`<!-- Via CDN -->
<script src="https://cdn.faceauth.dev/v1/faceauth.js"></script>`}</Code>
          <p style={{ marginTop: 8 }}>Ou via npm :</p>
          <Code>{`npm install @faceauth/sdk`}</Code>
        </Step>

        <Step n={2} title="Initialiser le client">
          <Code>{`// ESM
import { FaceAuth } from '@faceauth/sdk';

const faceauth = new FaceAuth({
  apiKey:     'sk_live_xxxxxxxxxxxx',  // Votre clé API
  apiBaseUrl: 'https://api.faceauth.dev',
  theme:      'auto',  // 'light' | 'dark' | 'auto'
});`}</Code>
        </Step>

        <Step n={3} title="Appeler enroll() ou verify()">
          <Code>{`// Enrôlement (première fois)
const result = await faceauth.enroll({
  endUserId: 'user_123',  // Votre identifiant interne
});

// Vérification (fois suivantes)
const result = await faceauth.verify({
  endUserId: 'user_123',
});

if (result.success && result.match) {
  console.log('Identité confirmée !', result.confidence);
}`}</Code>
        </Step>
      </DocSection>
    </div>
  );
}

function EnrollDocs() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <DocSection title="Enrôlement biométrique">
        <p>L'enrôlement enregistre le visage de référence d'un utilisateur. À appeler une seule fois par utilisateur (ou pour mettre à jour son visage de référence).</p>

        <h4 style={h4}>Signature</h4>
        <Code>{`faceauth.enroll(options: FaceAuthActionOptions): Promise<FaceAuthResult>`}</Code>

        <h4 style={h4}>Options</h4>
        <ParamTable rows={[
          ["endUserId", "string", "requis", "Identifiant de l'utilisateur dans votre système"],
          ["container", "HTMLElement", "optionnel", "Élément DOM hôte (défaut : document.body)"],
        ]} />

        <h4 style={h4}>Réponse succès</h4>
        <Code>{`{
  success:          true,
  endUserId:        "user_123",
  creditsRemaining: 498,
  message:          "Enrôlement biométrique réussi"
}`}</Code>

        <h4 style={h4}>Flux interne</h4>
        <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--gray-600)", lineHeight: 1.6 }}>
          <li>Appel à <code>/challenge/init</code> — génère la séquence aléatoire des 4 gestes</li>
          <li>Affichage du module de scan (Shadow DOM)</li>
          <li>Détection des gestes via MediaPipe (côté client, 0ms réseau)</li>
          <li>Capture d'une image JPEG 224x224 après validation</li>
          <li>Envoi de l'image + challenge_token à <code>/enroll</code></li>
          <li>Extraction DeepFace → stockage embedding dans pgvector</li>
          <li>Destruction immédiate de l'image source (&lt;500ms)</li>
        </ol>
      </DocSection>
    </div>
  );
}

function VerifyDocs() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <DocSection title="Vérification d'identité">
        <p>La vérification compare le visage soumis à l'embedding de référence enregistré lors de l'enrôlement.</p>

        <h4 style={h4}>Signature</h4>
        <Code>{`faceauth.verify(options: FaceAuthActionOptions): Promise<FaceAuthResult>`}</Code>

        <h4 style={h4}>Réponse succès</h4>
        <Code>{`{
  success:          true,
  endUserId:        "user_123",
  match:            true,
  confidence:       0.9724,   // 0 à 1 — seuil : 0.70
  creditsRemaining: 497,
  message:          "Identité vérifiée avec succès"
}`}</Code>

        <h4 style={h4}>Réponse échec de correspondance</h4>
        <Code>{`{
  success:   false,
  errorCode: "NO_FACE_DETECTED",
  message:   "Correspondance biométrique insuffisante"
}`}</Code>

        <h4 style={h4}>Cas d'usage recommandés</h4>
        <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--gray-600)", lineHeight: 1.6 }}>
          <li>Validation de transaction financière</li>
          <li>Connexion depuis un nouvel appareil ou une nouvelle localisation</li>
          <li>Récupération de mot de passe oublié</li>
          <li>Modification de coordonnées bancaires</li>
          <li>Signature électronique</li>
        </ul>
      </DocSection>
    </div>
  );
}

function ErrorDocs() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <DocSection title="Codes d'erreur">
        <p>Tous les cas d'erreur retournent <code>{`{ success: false, errorCode, message }`}</code>.</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--gray-100)" }}>
              {["Code", "HTTP", "Description"].map(h => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "11.5px", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["USER_CANCELLED",           "—",   "L'utilisateur a cliqué sur Annuler"],
              ["CAMERA_PERMISSION_DENIED", "—",   "Accès caméra refusé par l'utilisateur"],
              ["CAMERA_NOT_FOUND",         "—",   "Aucune caméra détectée sur l'appareil"],
              ["GESTURE_TIMEOUT",          "—",   "Les 4 gestes n'ont pas été complétés dans les 90s"],
              ["NETWORK_ERROR",            "—",   "Impossible de contacter le serveur"],
              ["INVALID_API_KEY",          "401", "Clé API invalide ou révoquée"],
              ["INSUFFICIENT_CREDITS",     "402", "Solde de crédits épuisé"],
              ["NO_FACE_DETECTED",         "422", "Aucun visage détecté dans l'image capturée"],
              ["USER_NOT_ENROLLED",        "404", "L'utilisateur n'a pas encore été enrôlé"],
              ["SESSION_ALREADY_USED",     "409", "Le challenge token a déjà été consommé"],
              ["INVALID_TOKEN",            "401", "Challenge token expiré ou invalide"],
            ].map(([code, http, desc]) => (
              <tr key={code} style={{ borderBottom: "1px solid var(--gray-100)" }}>
                <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: "12px", color: "var(--danger)" }}>{code}</td>
                <td style={{ padding: "9px 12px", textAlign: "center" }}>
                  {http !== "—" ? <Badge variant="gray">{http}</Badge> : <span style={{ color: "var(--gray-300)" }}>—</span>}
                </td>
                <td style={{ padding: "9px 12px", color: "var(--gray-600)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>
    </div>
  );
}

function SecurityDocs() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <DocSection title="Sécurité & Conformité">
        <h4 style={h4}>Architecture hybride client/serveur</h4>
        <p>
          La détection de vivacité (4 gestes) s'exécute entièrement dans le navigateur via MediaPipe WebAssembly —
          aucune image n'est envoyée au réseau pendant cette phase. Seule une image finale unique est transmise
          au serveur après validation des gestes.
        </p>

        <h4 style={h4}>Zéro stockage d'image</h4>
        <p>
          L'image source est détruite en moins de 500ms après l'extraction de l'embedding vectoriel.
          Seul le vecteur mathématique (512 dimensions, irréversible) est conservé en base.
        </p>

        <h4 style={h4}>Protection anti-replay</h4>
        <p>
          Chaque session de défi génère un JWT signé HS256 avec une durée de vie de 90 secondes.
          Un jeton ne peut être consommé qu'une seule fois (anti-replay via Redis).
        </p>

        <h4 style={h4}>Bonnes pratiques</h4>
        <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--gray-600)", lineHeight: 1.6 }}>
          <li>Ne jamais exposer votre clé <code>sk_live_...</code> côté client — elle doit rester serveur</li>
          <li>Utiliser des variables d'environnement, jamais hardcoder la clé dans le code source</li>
          <li>Révoquer immédiatement toute clé compromise depuis ce dashboard</li>
          <li>Le SDK web est conçu pour être utilisé depuis votre frontend — la clé est envoyée en header Authorization depuis le navigateur de votre utilisateur</li>
        </ul>
      </DocSection>
    </div>
  );
}

// --- Composants utilitaires docs ---

const h4: React.CSSProperties = {
  fontSize: "13px", fontWeight: 700, color: "var(--gray-700)",
  marginTop: "16px", marginBottom: "8px", letterSpacing: "-0.2px",
};

function DocSection({ title, badge, children }: {
  title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "17px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.4px" }}>
          {title}
        </h2>
        {badge && <Badge variant="blue">{badge}</Badge>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px", color: "var(--gray-600)", lineHeight: 1.65 }}>
        {children}
      </div>
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "14px", marginTop: "8px" }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: "var(--blue)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontWeight: 800, flexShrink: 0, marginTop: "2px",
      }}>
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, color: "var(--gray-800)", marginBottom: "8px" }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <pre style={{
        background: "var(--navy)",
        color: "#E2E8F0",
        borderRadius: "10px",
        padding: "16px",
        fontSize: "12px",
        overflowX: "auto",
        lineHeight: 1.7,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}>
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{
          position: "absolute", top: "10px", right: "10px",
          background: "rgba(255,255,255,0.1)", border: "none",
          color: "#94A3B8", fontSize: "11px", fontWeight: 600,
          padding: "4px 10px", borderRadius: "6px",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {copied ? "✓ Copié" : "Copier"}
      </button>
    </div>
  );
}

function ParamTable({ rows }: { rows: string[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid var(--gray-100)" }}>
          {["Param", "Type", "Requis", "Description"].map(h => (
            <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([param, type, req, desc]) => (
          <tr key={param} style={{ borderBottom: "1px solid var(--gray-100)" }}>
            <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--blue-dark)", fontWeight: 600 }}>{param}</td>
            <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--gray-500)" }}>{type}</td>
            <td style={{ padding: "8px 10px" }}><Badge variant={req === "requis" ? "blue" : "gray"}>{req}</Badge></td>
            <td style={{ padding: "8px 10px", color: "var(--gray-600)" }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
