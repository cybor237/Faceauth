import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const styles: Record<Variant, React.CSSProperties> = {
  primary:   { background: "var(--blue)", color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" },
  secondary: { background: "var(--white)", color: "var(--gray-700)", border: "1.5px solid var(--gray-200)" },
  danger:    { background: "var(--danger-bg)", color: "var(--danger)", border: "1.5px solid var(--danger-border)" },
  ghost:     { background: "transparent", color: "var(--gray-600)", border: "none" },
};

const sizes: Record<Size, React.CSSProperties> = {
  sm: { fontSize: "12px", padding: "6px 12px", borderRadius: "8px" },
  md: { fontSize: "13.5px", padding: "9px 18px", borderRadius: "10px" },
  lg: { fontSize: "15px", padding: "12px 24px", borderRadius: "12px" },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        transition: "transform 120ms ease, filter 120ms ease, opacity 120ms ease",
        ...styles[variant],
        ...sizes[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.08)";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = "";
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14,
      border: "2px solid currentColor",
      borderTopColor: "transparent",
      borderRadius: "50%",
      display: "inline-block",
      animation: "btn-spin 0.7s linear infinite",
    }} />
  );
}
