import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "success" | "muted" | "outline";
  size?: "sm" | "md";
}

export function Badge({
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-bg-raised text-fg-muted border-border",
    accent: "bg-accent-soft text-accent-text border-accent-ring/30",
    success: "bg-emerald-950/40 text-emerald-300 border-emerald-800/40",
    muted: "bg-bg-elevated text-fg-subtle border-border/50",
    outline: "bg-transparent text-fg border-border-strong",
  }[variant];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-mono",
    md: "px-2.5 py-1 text-xs",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border font-medium uppercase tracking-[0.08em] select-none",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
