import type { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "article";
  tone?: "default" | "emphasis" | "quiet";
  children: ReactNode;
}

export function Panel({
  as: Component = "section",
  tone = "default",
  className = "",
  children,
  ...props
}: PanelProps) {
  return (
    <Component className={`panel panel--${tone} ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action}
    </header>
  );
}
