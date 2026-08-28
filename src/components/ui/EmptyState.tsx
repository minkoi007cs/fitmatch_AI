import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { DARK_BLUR_DATA_URL } from "@/lib/images";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  eyebrow?: string;
  headline: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  imageSrc,
  imageAlt = "Empty state illustration",
  eyebrow,
  headline,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-[8px] border border-dashed border-border bg-bg-elevated/40 max-w-2xl mx-auto my-8",
        className
      )}
    >
      {imageSrc ? (
        <div className="relative w-32 h-40 mb-6 overflow-hidden rounded-[2px] border border-border">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes="128px"
            placeholder="blur"
            blurDataURL={DARK_BLUR_DATA_URL}
            className="object-cover opacity-60 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent" />
        </div>
      ) : icon ? (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border-strong bg-bg-raised text-fg-muted">
          {icon}
        </div>
      ) : null}

      {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}

      <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-fg mb-2">
        {headline}
      </h3>

      <p className="text-sm text-fg-muted max-w-md leading-relaxed mb-6 font-normal">
        {body}
      </p>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
