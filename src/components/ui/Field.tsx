import React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="text-xs uppercase tracking-[0.14em] font-medium text-fg-muted select-none"
        >
          {label}
          {required ? <span className="text-accent-text ml-1">*</span> : null}
        </label>
      </div>
      {children}
      {error ? (
        <span className="text-xs text-danger font-normal mt-0.5">{error}</span>
      ) : hint ? (
        <span className="text-xs text-fg-subtle font-normal mt-0.5">{hint}</span>
      ) : null}
    </div>
  );
}
