import { useEffect, useState } from "react";
import { TopBar } from "../components/Layout/TopBar";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useAPI } from "../hooks/useAPI";
import type { APIKey } from "../types";

export function ApiKeys() {
  const { request }           = useAPI();
  const [keys, setKeys]       = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchKeys = async () => {
    try {
      const data = await request<{ keys: APIKey[] }>("/dashboard/keys");
      setKeys(data.keys);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const data = await request<{ raw_key: string; api_key: APIKey }>("/dashboard/keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setRevealedKey(data.raw_key);
      setNewKeyName("");
      setShowForm(false);
      await fetchKeys();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Révoquer cette clé ? Les appels en cours utilisant cette clé échoueront.")) return;
    setRevoking(id);
    try {
      await request(`/dashboard/keys/${id}/revoke`, { method: "PATCH" });
      await fetchKeys();
    } catch (e) {
      console.error(e);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="page-enter" style={{ flex: 1, overflow: "auto" }}>
      <TopBar title="API Keys" subtitle="Gérez vos clés d'accès au SDK FaceAuth" />
      <div style={{ padding: "28px" }}>

        {/* Clé révélée après création */}
        {revealedKey && (
          <div style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "12px",
            background: "#F0FDF4",
            border: "1.5px solid #BBF7D0",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#15803D" }}>
                ✅ Clé générée — copiez-la maintenant, elle ne sera plus affichée
              </span>
              <Button variant="ghost" size="sm" onClick={() => setRevealedKey(null)}>✕</Button>
            </div>
            <div style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "10px 14px",
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#111827",
              border: "1px solid #BBF7D0",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
              wordBreak: "break-all",
            }}>
              <code>{revealedKey}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(revealedKey)}
              >
                Copier
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardHeader
            title="Mes clés API"
            subtitle={`${keys.filter(k => k.is_active).length} clé(s) active(s)`}
            action={
              <Button size="sm" onClick={() => setShowForm(!showForm)} icon={<span>+</span>}>
                Nouvelle clé
              </Button>
            }
          />

          {/* Formulaire de création */}
          {showForm && (
            <div style={{
              marginBottom: "20px",
              padding: "16px",
              borderRadius: "10px",
              background: "var(--gray-50)",
              border: "1px solid var(--gray-200)",
            }}>
              <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "var(--gray-700)" }}>
                Nom de la clé (ex: Production App, Test SDK...)
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Ma clé de production"
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--gray-200)",
                    fontSize: "13.5px",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                  autoFocus
                />
                <Button loading={creating} onClick={handleCreate} disabled={!newKeyName.trim()}>
                  Générer
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Liste des clés */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: "10px" }} />)}
            </div>
          ) : keys.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px",
              color: "var(--gray-400)", fontSize: "13px",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔑</div>
              Aucune clé API. Créez votre première clé pour commencer.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {keys.map((key) => (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  revoking={revoking === key.id}
                  onRevoke={() => handleRevoke(key.id)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Info sécurité */}
        <div style={{
          marginTop: "16px",
          padding: "14px 16px",
          borderRadius: "10px",
          background: "var(--blue-faint)",
          border: "1px solid var(--blue-border)",
          fontSize: "12.5px",
          color: "var(--blue-dark)",
          lineHeight: 1.6,
        }}>
          🔒 <strong>Important :</strong> Les clés API ne sont affichées qu'une seule fois à la création.
          Ne les partagez jamais et ne les committez pas dans votre code source.
          Utilisez des variables d'environnement.
        </div>
      </div>
    </div>
  );
}

function KeyRow({ apiKey, revoking, onRevoke }: {
  apiKey: APIKey;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(apiKey.key_prefix + "...");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderRadius: "10px",
      border: "1.5px solid var(--gray-200)",
      background: apiKey.is_active ? "var(--white)" : "var(--gray-50)",
      gap: "12px",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <Badge variant={apiKey.is_active ? "success" : "gray"} dot>
          {apiKey.is_active ? "Active" : "Révoquée"}
        </Badge>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--gray-900)" }}>
            {apiKey.name || "Sans nom"}
          </div>
          <div style={{
            fontSize: "12px", color: "var(--gray-500)",
            fontFamily: "monospace", display: "flex", alignItems: "center", gap: "6px",
          }}>
            {apiKey.key_prefix}••••••••••••••••
            <button onClick={copy} style={{
              background: "none", border: "none",
              cursor: "pointer", color: "var(--blue)", fontSize: "11px", fontFamily: "inherit",
            }}>
              {copied ? "✓ Copié" : "copier préfixe"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--gray-900)" }}>
            {apiKey.credits.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>crédits</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>
            Créée {new Date(apiKey.created_at).toLocaleDateString("fr-FR")}
          </div>
          {apiKey.last_used_at && (
            <div style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>
              Utilisée {new Date(apiKey.last_used_at).toLocaleDateString("fr-FR")}
            </div>
          )}
        </div>
        {apiKey.is_active && (
          <Button
            variant="danger"
            size="sm"
            loading={revoking}
            onClick={onRevoke}
          >
            Révoquer
          </Button>
        )}
      </div>
    </div>
  );
}
