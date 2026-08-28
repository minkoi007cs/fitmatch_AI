import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full" | "none";
}

export function Skeleton({ rounded = "sm", className, ...props }: SkeletonProps) {
  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded-[2px]",
    md: "rounded-[4px]",
    lg: "rounded-[8px]",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      className={cn(
        "animate-pulse bg-bg-raised/70 border border-border/40",
        roundedClasses,
        className
      )}
      {...props}
    />
  );
}
