import React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  const alignmentClass = {
    left: "text-left items-start",
    center: "text-center items-center mx-auto",
    right: "text-right items-end ml-auto",
  }[align];

  return (
    <div className={cn("flex flex-col mb-8 sm:mb-12", alignmentClass, className)}>
      {eyebrow ? (
        <div className="eyebrow text-accent-text mb-3">{eyebrow}</div>
      ) : null}
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-fg leading-[1.0]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-2xl leading-relaxed font-normal">
          {description}
        </p>
      ) : null}
    </div>
  );
}
