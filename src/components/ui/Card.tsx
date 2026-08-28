import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-border bg-bg-elevated transition-colors duration-200",
        interactive && "hover:border-border-strong hover:bg-bg-raised/40 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
