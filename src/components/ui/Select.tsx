import React, { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            "w-full h-11 appearance-none bg-bg-raised border rounded-[4px] pl-3.5 pr-10 py-2.5 text-sm text-fg transition duration-150 focus:outline-none focus:ring-1 focus:ring-accent-ring focus:border-accent-text/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
            error ? "border-danger focus:ring-danger/50" : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
      </div>
    );
  }
);

Select.displayName = "Select";
