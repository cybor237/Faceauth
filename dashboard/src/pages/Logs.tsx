import { useEffect, useState, useCallback } from "react";
import { TopBar } from "../components/Layout/TopBar";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useAPI } from "../hooks/useAPI";
import type { AuditLog } from "../types";

const ACTION_MAP: Record<string, { label: string; variant: "success" | "danger" | "blue" | "gray" }> = {
  enroll:         { label: "Enrôlement",    variant: "blue" },
  verify_success: { label: "Vérifié ✓",     variant: "success" },
  verify_failed:  { label: "Échec vérif.",  variant: "danger" },
  error:          { label: "Erreur",         variant: "danger" },
};

const FILTERS = ["Tous", "Enrôlements", "Succès", "Échecs"];

export function Logs() {
  const { request }           = useAPI();
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("Tous");
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const PER_PAGE = 20;

  const actionFilter: Record<string, string> = {
    "Enrôlements": "enroll",
    "Succès":      "verify_success",
    "Échecs":      "verify_failed",
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const action = actionFilter[filter] ?? "";
      const params = new URLSearchParams({
        limit:  String(PER_PAGE),
        offset: String((page - 1) * PER_PAGE),
        ...(action ? { action } : {}),
      });
      const data = await request<{ logs: AuditLog[]; total: number }>(`/dashboard/logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [request, filter, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="page-enter" style={{ flex: 1, overflow: "auto" }}>
      <TopBar title="Logs d'audit" subtitle="Historique complet des vérifications biométriques" />
      <div style={{ padding: "28px" }}>

        {/* Filtres */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "1.5px solid",
                borderColor: filter === f ? "var(--blue)" : "var(--gray-200)",
                background:  filter === f ? "var(--blue-faint)" : "var(--white)",
                color:       filter === f ? "var(--blue-dark)"  : "var(--gray-500)",
                fontSize: "12.5px", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 150ms ease",
              }}
            >
              {f}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "12.5px", color: "var(--gray-400)", alignSelf: "center" }}>
            {total.toLocaleString()} entrée{total > 1 ? "s" : ""}
          </span>
        </div>

        <Card padding="0">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--gray-100)" }}>
                {["Action", "Utilisateur", "Score", "IP", "Crédits", "Date"].map((h) => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    fontSize: "11.5px", fontWeight: 700,
                    color: "var(--gray-400)", textTransform: "uppercase",
                    letterSpacing: "0.5px", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} style={{ padding: "12px 16px" }}>
                        <div className="skeleton" style={{ height: 16, width: `${60 + j * 10}%`, borderRadius: "4px" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px", color: "var(--gray-400)" }}>
                    Aucun log pour ce filtre
                  </td>
                </tr>
              ) : logs.map((log, i) => {
                const a = ACTION_MAP[log.action] ?? { label: log.action, variant: "gray" as const };
                return (
                  <tr key={log.id} style={{
                    borderBottom: "1px solid var(--gray-100)",
                    background: i % 2 === 0 ? "transparent" : "var(--gray-50)",
                  }}>
                    <td style={{ padding: "10px 16px" }}>
                      <Badge variant={a.variant}>{a.label}</Badge>
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "monospace", color: "var(--gray-700)", fontSize: "12px" }}>
                      {log.end_user_id}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--gray-600)" }}>
                      {log.similarity_score != null
                        ? <span style={{ fontWeight: 700, color: log.similarity_score >= 0.7 ? "var(--success)" : "var(--danger)" }}>
                            {(log.similarity_score * 100).toFixed(1)}%
                          </span>
                        : <span style={{ color: "var(--gray-300)" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--gray-400)", fontFamily: "monospace", fontSize: "12px" }}>
                      {log.ip_address ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                        {log.credits_before} → <strong style={{ color: "var(--gray-700)" }}>{log.credits_after}</strong>
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--gray-400)", whiteSpace: "nowrap", fontSize: "12px" }}>
                      {new Date(log.created_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderTop: "1px solid var(--gray-100)",
            }}>
              <span style={{ fontSize: "12.5px", color: "var(--gray-400)" }}>
                Page {page} / {totalPages}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  ← Précédent
                </Button>
                <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  Suivant →
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
