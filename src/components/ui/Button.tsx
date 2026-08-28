import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "accent" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  pill?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "accent",
      size = "md",
      loading = false,
      pill = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-11 px-5 text-sm gap-2",
      lg: "h-13 px-7 text-base gap-2.5",
    }[size];

    const variantClasses = {
      accent:
        "bg-accent hover:bg-accent-hover text-[#0A0A0B] font-semibold border border-transparent shadow-sm active:translate-y-[1px]",
      outline:
        "bg-transparent hover:bg-bg-raised text-fg border border-border-strong active:bg-bg-raised/80",
      ghost:
        "bg-transparent hover:bg-bg-raised text-fg-muted hover:text-fg border border-transparent",
      danger:
        "bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-medium",
    }[variant];

    const radiusClass = pill ? "rounded-full" : "rounded-[8px]";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent-ring focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed cursor-pointer select-none",
          radiusClass,
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : icon ? <span className="shrink-0">{icon}</span> : null}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
