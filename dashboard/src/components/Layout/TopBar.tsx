interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <div style={{
      height: "var(--topbar-h)",
      borderBottom: "1px solid var(--gray-200)",
      display: "flex",
      alignItems: "center",
      padding: "0 28px",
      background: "var(--white)",
      flexShrink: 0,
      gap: "12px",
    }}>
      <div>
        <h1 style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--gray-900)",
          letterSpacing: "-0.4px",
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "1px" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
