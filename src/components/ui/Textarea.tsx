import React, { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full bg-bg-raised border rounded-[4px] px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle/70 transition duration-150 focus:outline-none focus:ring-1 focus:ring-accent-ring focus:border-accent-text/60 disabled:opacity-50 disabled:cursor-not-allowed resize-y",
          error ? "border-danger focus:ring-danger/50" : "border-border hover:border-border-strong",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
