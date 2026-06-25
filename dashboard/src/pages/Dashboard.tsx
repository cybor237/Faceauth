import { useEffect, useState } from "react";
import { TopBar } from "../components/Layout/TopBar";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useAPI } from "../hooks/useAPI";
import type { DashboardStats, AuditLog } from "../types";

export function Dashboard() {
  const { request }           = useAPI();
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      request<DashboardStats>("/dashboard/stats"),
      request<{ logs: AuditLog[] }>("/dashboard/logs?limit=5"),
    ]).then(([s, l]) => {
      setStats(s);
      setLogs(l.logs);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [request]);

  return (
    <div className="page-enter" style={{ flex: 1, overflow: "auto" }}>
      <TopBar title="Dashboard" subtitle="Vue d'ensemble de votre activité" />
      <div style={{ padding: "28px" }}>

        {/* Statistiques */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}>
          <StatCard
            label="Crédits restants"
            value={loading ? "—" : stats?.credits_remaining.toLocaleString() ?? "0"}
            icon="💳"
            accent="var(--blue)"
            loading={loading}
          />
          <StatCard
            label="Vérifications totales"
            value={loading ? "—" : stats?.total_verifications.toLocaleString() ?? "0"}
            icon="✅"
            accent="var(--success)"
            loading={loading}
          />
          <StatCard
            label="Taux de succès"
            value={loading ? "—" : stats && stats.total_verifications > 0
              ? `${Math.round((stats.successful_verifications / stats.total_verifications) * 100)}%`
              : "—"}
            icon="📊"
            accent="#8B5CF6"
            loading={loading}
          />
          <StatCard
            label="Clés API actives"
            value={loading ? "—" : stats?.api_keys_count.toLocaleString() ?? "0"}
            icon="🔑"
            accent="#F59E0B"
            loading={loading}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Activité récente */}
          <Card>
            <CardHeader title="Activité récente" subtitle="5 dernières opérations" />
            {loading ? (
              <SkeletonList rows={5} />
            ) : logs.length === 0 ? (
              <Empty message="Aucune activité pour l'instant" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </Card>

          {/* Utilisation des crédits */}
          <Card>
            <CardHeader title="Consommation" subtitle="Crédits utilisés" />
            {loading ? (
              <SkeletonList rows={3} />
            ) : (
              <>
                <CreditBar
                  used={stats?.total_credits_used ?? 0}
                  remaining={stats?.credits_remaining ?? 0}
                />
                <div style={{
                  display: "flex", gap: "16px",
                  marginTop: "16px", fontSize: "12.5px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--gray-500)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--blue)", display: "inline-block" }} />
                    Consommés : <strong style={{ color: "var(--gray-900)" }}>{stats?.total_credits_used ?? 0}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--gray-500)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--gray-200)", display: "inline-block" }} />
                    Restants : <strong style={{ color: "var(--gray-900)" }}>{stats?.credits_remaining ?? 0}</strong>
                  </div>
                </div>

                {(stats?.credits_remaining ?? 0) < 50 && (
                  <div style={{
                    marginTop: "16px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: "var(--warning-bg)",
                    border: "1px solid #FDE68A",
                    fontSize: "12.5px",
                    color: "#B45309",
                    display: "flex", alignItems: "center", gap: "8px",
                  }}>
                    ⚠️ Solde faible — rechargez vos crédits
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// -- Sous-composants --

function StatCard({ label, value, icon, accent, loading }: {
  label: string; value: string; icon: string; accent: string; loading: boolean;
}) {
  return (
    <Card padding="20px">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            {label}
          </p>
          {loading ? (
            <div className="skeleton" style={{ width: 80, height: 28, borderRadius: "6px" }} />
          ) : (
            <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-0.8px" }}>
              {value}
            </p>
          )}
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: "10px",
          background: `${accent}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const actionMap: Record<string, { label: string; variant: "success" | "danger" | "blue" | "gray" }> = {
    enroll:         { label: "Enrôlement",   variant: "blue" },
    verify_success: { label: "Vérifié ✓",    variant: "success" },
    verify_failed:  { label: "Échec vérif.", variant: "danger" },
    error:          { label: "Erreur",        variant: "danger" },
  };
  const a = actionMap[log.action] ?? { label: log.action, variant: "gray" as const };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: "1px solid var(--gray-100)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Badge variant={a.variant}>{a.label}</Badge>
        <span style={{ fontSize: "12.5px", color: "var(--gray-600)", fontFamily: "monospace" }}>
          {log.end_user_id}
        </span>
      </div>
      <span style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>
        {new Date(log.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

function CreditBar({ used, remaining }: { used: number; remaining: number }) {
  const total = used + remaining;
  const pct   = total > 0 ? Math.round((remaining / total) * 100) : 100;
  const color = pct > 30 ? "var(--blue)" : pct > 10 ? "var(--warning)" : "var(--danger)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--gray-500)", marginBottom: "8px" }}>
        <span>Solde</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: "var(--gray-100)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color,
          borderRadius: "4px",
          transition: "width 600ms var(--ease)",
        }} />
      </div>
    </div>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 20, borderRadius: "6px", opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--gray-400)", fontSize: "13px" }}>
      {message}
    </div>
  );
}
