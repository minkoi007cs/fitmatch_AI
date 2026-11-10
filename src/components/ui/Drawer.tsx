"use client";

import React, { useEffect, useRef, useEffectEvent } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  width?: "sm" | "md" | "lg";
}

export function Drawer({
  isOpen,
  onClose,
  title,
  eyebrow,
  description,
  children,
  className,
  width = "md",
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useEffectEvent(onClose);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && isOpen) {
        const nodes = drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]');
        const focusable = Array.from(nodes ?? []).filter(node => node.getClientRects().length > 0);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first) { event.preventDefault(); drawerRef.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === drawerRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === "Escape" && isOpen) {
        close();
      }
    };

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (isOpen) {
      drawerRef.current?.focus();
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (isOpen) previousFocus?.focus();
    };
  }, [isOpen]);

  const widthClasses = {
    sm: "max-w-md",
    md: "max-w-[480px]",
    lg: "max-w-2xl",
  }[width];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className={cn(
              "relative z-10 flex h-full w-full flex-col border-l border-border-strong bg-bg-elevated text-fg shadow-2xl overflow-hidden",
              widthClasses,
              className
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-6 shrink-0">
              <div>
                {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
                <h2 id="drawer-title" className="font-display text-2xl font-bold tracking-tight text-fg">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-xs text-fg-muted leading-relaxed font-normal">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-raised p-2 text-fg-muted hover:text-fg hover:border-border-strong transition"
                aria-label="Đóng bảng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
