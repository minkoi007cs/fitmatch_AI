import React from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  colorSwatch?: string;
  icon?: React.ReactNode;
  count?: number;
}

export function Chip({
  children,
  active = false,
  colorSwatch,
  icon,
  count,
  className,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-[4px] px-3.5 py-1.5 text-xs tracking-wide transition-all duration-150 cursor-pointer select-none border",
        active
          ? "bg-accent-soft border-accent-text/80 text-accent-text font-medium shadow-[0_0_12px_rgba(196,98,45,0.12)]"
          : "bg-bg-raised/60 border-border text-fg-muted hover:text-fg hover:border-border-strong hover:bg-bg-raised",
        className
      )}
      {...props}
    >
      {colorSwatch ? (
        <span
          className="h-2.5 w-2.5 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: colorSwatch }}
        />
      ) : null}
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className="font-mono text-[10px] tabular-nums opacity-60 ml-0.5">({count})</span>
      ) : null}
    </button>
  );
}
