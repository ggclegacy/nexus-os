"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  "primary" | "secondary" | "tertiary" | "destructive" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="button__spinner" aria-hidden="true" /> : icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}
