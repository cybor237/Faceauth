import { useEffect, useState } from "react";
import { TopBar } from "../components/Layout/TopBar";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useAPI } from "../hooks/useAPI";
import { CREDIT_PACKS } from "../types";

interface CreditsData {
  credits_remaining: number;
  total_credits_used: number;
  total_verifications: number;
}

export function Credits() {
  const { request }         = useAPI();
  const [data, setData]     = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<CreditsData>("/dashboard/stats")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [request]);

  return (
    <div className="page-enter" style={{ flex: 1, overflow: "auto" }}>
      <TopBar title="Crédits" subtitle="Gérez votre solde de vérifications biométriques" />
      <div style={{ padding: "28px" }}>

        {/* Solde actuel */}
        <div style={{
          background: "linear-gradient(135deg, var(--navy) 0%, #1E3A8A 100%)",
          borderRadius: "16px",
          padding: "28px",
          marginBottom: "24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "16px",
        }}>
          <div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", marginBottom: "6px", fontWeight: 500 }}>
              Solde actuel
            </p>
            {loading ? (
              <div className="skeleton" style={{ width: 120, height: 44, borderRadius: "8px", background: "rgba(255,255,255,0.1)" }} />
            ) : (
              <p style={{ fontSize: "44px", fontWeight: 900, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1 }}>
                {(data?.credits_remaining ?? 0).toLocaleString()}
                <span style={{ fontSize: "16px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginLeft: "8px" }}>
                  crédits
                </span>
              </p>
            )}
            <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginTop: "8px" }}>
              {data?.total_verifications ?? 0} vérifications effectuées · {data?.total_credits_used ?? 0} crédits consommés
            </p>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "16px 20px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>
              Prix moyen / vérification
            </p>
            <p style={{ fontSize: "22px", fontWeight: 800, color: "#60A5FA" }}>
              ~0,04$
            </p>
          </div>
        </div>

        {/* Packs de crédits */}
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "14px", letterSpacing: "-0.3px" }}>
          Recharger mes crédits
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}>
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              style={{
                background: pack.highlighted ? "linear-gradient(135deg, #111827 0%, #1E3A8A 100%)" : "var(--white)",
                borderRadius: "16px",
                border: pack.highlighted ? "none" : "1.5px solid var(--gray-200)",
                padding: "24px",
                position: "relative",
                boxShadow: pack.highlighted ? "0 8px 24px rgba(37,99,235,0.25)" : "var(--shadow-sm)",
              }}
            >
              {pack.highlighted && (
                <div style={{
                  position: "absolute", top: -10, right: 16,
                  background: "var(--blue)",
                  color: "#fff", fontSize: "11px", fontWeight: 700,
                  padding: "4px 12px", borderRadius: "20px",
                  letterSpacing: "0.3px",
                }}>
                  POPULAIRE
                </div>
              )}

              <p style={{
                fontSize: "14px", fontWeight: 700, marginBottom: "8px",
                color: pack.highlighted ? "#fff" : "var(--gray-900)",
              }}>
                Pack {pack.name}
              </p>

              {pack.id === "enterprise" ? (
                <>
                  <p style={{ fontSize: "28px", fontWeight: 900, color: pack.highlighted ? "#fff" : "var(--gray-900)", letterSpacing: "-1px", marginBottom: "4px" }}>
                    Sur devis
                  </p>
                  <p style={{ fontSize: "12.5px", color: pack.highlighted ? "rgba(255,255,255,0.5)" : "var(--gray-400)", marginBottom: "20px" }}>
                    Volume illimité · SLA garanti · Conformité avancée
                  </p>
                  <Button
                    variant="secondary"
                    style={{ width: "100%" }}
                    onClick={() => window.open("mailto:sales@faceauth.dev?subject=Pack Entreprise", "_blank")}
                  >
                    Nous contacter →
                  </Button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "4px" }}>
                    <p style={{ fontSize: "32px", fontWeight: 900, color: pack.highlighted ? "#fff" : "var(--gray-900)", letterSpacing: "-1px" }}>
                      {pack.price_usd}$
                    </p>
                    <span style={{ fontSize: "13px", color: pack.highlighted ? "rgba(255,255,255,0.5)" : "var(--gray-400)" }}>
                      USD
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: pack.highlighted ? "rgba(255,255,255,0.6)" : "var(--gray-500)", marginBottom: "6px" }}>
                    {pack.credits.toLocaleString()} crédits
                  </p>
                  <p style={{
                    fontSize: "12px",
                    color: pack.highlighted ? "#60A5FA" : "var(--blue)",
                    fontWeight: 600, marginBottom: "20px",
                  }}>
                    {pack.price_per_credit.toFixed(3)}$ / crédit
                  </p>
                  <Button
                    style={{ width: "100%", justifyContent: "center" }}
                    variant={pack.highlighted ? "secondary" : "primary"}
                    onClick={() => alert("Intégration Stripe à venir — contactez sales@faceauth.dev")}
                  >
                    Acheter ce pack
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Pack découverte */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "12px",
              background: "var(--success-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", flexShrink: 0,
            }}>
              🎁
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--gray-900)" }}>
                Pack Découverte — Gratuit
              </p>
              <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "2px" }}>
                500 crédits offerts à chaque nouveau compte. Suffisant pour vos tests d'intégration et votre POC.
              </p>
            </div>
            <Badge variant="success" style={{ flexShrink: 0 }}>Inclus</Badge>
          </div>
        </Card>

        {/* Note de facturation */}
        <div style={{
          marginTop: "16px",
          padding: "14px 16px", borderRadius: "10px",
          background: "var(--blue-faint)", border: "1px solid var(--blue-border)",
          fontSize: "12.5px", color: "var(--blue-dark)", lineHeight: 1.6,
        }}>
          💡 <strong>Modèle prépayé :</strong> Les crédits sont débitables dès que le serveur traite une vérification,
          qu'elle soit réussie ou non. L'API retourne HTTP 402 si votre solde est à zéro.
        </div>
      </div>
    </div>
  );
}
