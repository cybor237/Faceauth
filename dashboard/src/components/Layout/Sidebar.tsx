import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const NAV_ITEMS = [
  { path: "/",        label: "Dashboard",      icon: "⊞" },
  { path: "/keys",    label: "API Keys",        icon: "🔑" },
  { path: "/logs",    label: "Logs d'audit",   icon: "📋" },
  { path: "/credits", label: "Crédits",         icon: "💳" },
  { path: "/docs",    label: "Documentation",   icon: "📖" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <aside style={{
      width: "var(--sidebar-w)",
      minHeight: "100vh",
      background: "var(--navy)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      height: "100vh",
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{
        padding: "22px 20px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, var(--blue) 0%, var(--blue-dark) 100%)",
            borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1 }}>
              Face<span style={{ color: "#60A5FA" }}>Auth</span>
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              borderRadius: "10px",
              marginBottom: "2px",
              fontSize: "13.5px",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
              background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
              transition: "all 150ms ease",
              textDecoration: "none",
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (!el.classList.contains("active")) {
                el.style.color = "rgba(255,255,255,0.85)";
                el.style.background = "rgba(255,255,255,0.05)";
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (!el.classList.contains("active")) {
                el.style.color = "rgba(255,255,255,0.55)";
                el.style.background = "transparent";
              }
            }}
          >
            <span style={{ fontSize: "15px", width: 20, textAlign: "center", flexShrink: 0 }}>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Profil + déconnexion */}
      <div style={{
        padding: "12px 10px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 12px",
          borderRadius: "10px",
          marginBottom: "4px",
        }}>
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--blue)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", color: "#fff", fontWeight: 700, flexShrink: 0,
            }}>
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#fff", truncate: true, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.displayName ?? user?.email?.split("@")[0]}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)",
            fontSize: "12.5px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 150ms ease",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
            (e.currentTarget as HTMLButtonElement).style.color = "#F87171";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
          }}
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
