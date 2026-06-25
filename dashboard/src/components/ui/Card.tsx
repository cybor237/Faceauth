import React from "react";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: string;
}

export function Card({ children, style, padding = "24px" }: CardProps) {
  return (
    <div style={{
      background: "var(--white)",
      borderRadius: "var(--radius)",
      boxShadow: "var(--shadow-sm)",
      border: "1px solid var(--gray-200)",
      padding,
      ...style,
    }}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: "20px",
      gap: "12px",
    }}>
      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.3px" }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "2px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
