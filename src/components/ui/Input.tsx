import React, { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, type = "text", ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon ? (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none flex items-center">
            {icon}
          </div>
        ) : null}
        <input
          ref={ref}
          type={type}
          className={cn(
            "w-full h-11 bg-bg-raised border rounded-[4px] px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle/70 transition duration-150 focus:outline-none focus:ring-1 focus:ring-accent-ring focus:border-accent-text/60 disabled:opacity-50 disabled:cursor-not-allowed",
            icon ? "pl-10" : "pl-3.5",
            error ? "border-danger focus:ring-danger/50" : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
