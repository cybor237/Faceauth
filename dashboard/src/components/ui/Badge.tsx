import React from "react";

type BadgeVariant = "success" | "danger" | "warning" | "blue" | "gray";

const variants: Record<BadgeVariant, React.CSSProperties> = {
  success: { background: "var(--success-bg)", color: "#15803D", border: "1px solid var(--success-border)" },
  danger:  { background: "var(--danger-bg)", color: "#DC2626", border: "1px solid var(--danger-border)" },
  warning: { background: "var(--warning-bg)", color: "#B45309", border: "1px solid #FDE68A" },
  blue:    { background: "var(--blue-faint)", color: "var(--blue-dark)", border: "1px solid var(--blue-border)" },
  gray:    { background: "var(--gray-100)", color: "var(--gray-600)", border: "1px solid var(--gray-200)" },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ children, variant = "gray", dot = false }: BadgeProps) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontSize: "11.5px",
      fontWeight: 600,
      padding: "3px 9px",
      borderRadius: "20px",
      whiteSpace: "nowrap",
      ...variants[variant],
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6,
          borderRadius: "50%",
          background: "currentColor",
          opacity: 0.8,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}
