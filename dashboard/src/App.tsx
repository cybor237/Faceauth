import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Sidebar } from "./components/Layout/Sidebar";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { ApiKeys } from "./pages/ApiKeys";
import { Logs } from "./pages/Logs";
import { Credits } from "./pages/Credits";
import { Docs } from "./pages/Docs";

// ----------------------------------------------------------------
// Guard — redirige vers /auth si non connecté
// ----------------------------------------------------------------
function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;
  if (!user)   return <Navigate to="/auth" replace />;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/keys"    element={<ApiKeys />} />
          <Route path="/logs"    element={<Logs />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/docs"    element={<Docs />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------
// App principale
// ----------------------------------------------------------------
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthGuard />} />
        <Route path="/*"    element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

// Redirige vers / si déjà connecté
function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user)    return <Navigate to="/" replace />;
  return <Auth />;
}

// Écran de chargement initial
function Splash() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "16px",
    }}>
      <div style={{
        width: 56, height: 56,
        background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
        borderRadius: "16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "28px",
        boxShadow: "0 8px 24px rgba(37,99,235,0.4)",
      }}>
        👤
      </div>
      <div style={{
        width: 32, height: 32,
        border: "3px solid rgba(255,255,255,0.15)",
        borderTopColor: "white",
        borderRadius: "50%",
        animation: "splash-spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes splash-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
