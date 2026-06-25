import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";

export function Auth() {
  const { loginWithGoogle, loginWithGitHub } = useAuth();
  const navigate = useNavigate();
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState<"google" | "github" | null>(null);

  const handleLogin = async (provider: "google" | "github") => {
    setError("");
    setLoading(provider);
    try {
      if (provider === "google") await loginWithGoogle();
      else await loginWithGitHub();
      navigate("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de connexion";
      if (!msg.includes("popup-closed")) setError(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "24px",
        padding: "40px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #111827 0%, #1E3A8A 100%)",
            borderRadius: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "26px",
            margin: "0 auto 14px",
          }}>
            👤
          </div>
          <h1 style={{
            fontSize: "22px", fontWeight: 800,
            color: "#111827", letterSpacing: "-0.6px",
            marginBottom: "4px",
          }}>
            Face<span style={{ color: "#2563EB" }}>Auth</span>
          </h1>
          <p style={{ fontSize: "13px", color: "#6B7280" }}>
            Connectez-vous à votre espace développeur
          </p>
        </div>

        {/* Boutons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => handleLogin("google")}
            disabled={loading !== null}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1.5px solid #E5E7EB",
              background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "10px",
              fontSize: "14px", fontWeight: 600, color: "#374151",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 150ms ease",
              fontFamily: "inherit",
            }}
          >
            {loading === "google" ? (
              <Spinner />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continuer avec Google
          </button>

          <button
            onClick={() => handleLogin("github")}
            disabled={loading !== null}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "none",
              background: "#24292F",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "10px",
              fontSize: "14px", fontWeight: 600, color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 150ms ease",
              fontFamily: "inherit",
            }}
          >
            {loading === "github" ? (
              <Spinner color="#fff" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            )}
            Continuer avec GitHub
          </button>
        </div>

        {error && (
          <p style={{
            marginTop: "14px", textAlign: "center",
            fontSize: "13px", color: "#DC2626",
            background: "#FEF2F2",
            padding: "8px 12px", borderRadius: "8px",
            border: "1px solid #FECACA",
          }}>
            {error}
          </p>
        )}

        {/* Footer */}
        <p style={{
          marginTop: "24px", textAlign: "center",
          fontSize: "11.5px", color: "#9CA3AF", lineHeight: 1.5,
        }}>
          En vous connectant, vous acceptez nos conditions d'utilisation.
          <br />
          <span style={{ color: "#6B7280" }}>500 crédits offerts à l'inscription.</span>
        </p>
      </div>
    </div>
  );
}

function Spinner({ color = "#374151" }: { color?: string }) {
  return (
    <span style={{
      width: 16, height: 16,
      border: `2px solid ${color}30`,
      borderTopColor: color,
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}
