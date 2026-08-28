"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", duration = 4500) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, duration?: number) => toast(message, "success", duration),
    [toast]
  );

  const error = useCallback(
    (message: string, duration?: number) => toast(message, "error", duration),
    [toast]
  );

  const info = useCallback(
    (message: string, duration?: number) => toast(message, "info", duration),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, info, removeToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-md w-full px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((item) => (
            <ToastItemComponent key={item.id} item={item} onClose={() => removeToast(item.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemComponent({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const getIcon = () => {
    switch (item.type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />;
      default:
        return <Info className="h-4 w-4 text-accent-text shrink-0 mt-0.5" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto flex items-start justify-between gap-3 rounded-[8px] border border-border-strong bg-bg-elevated/95 backdrop-blur-xl p-4 shadow-2xl text-sm text-fg"
      role="alert"
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <p className="leading-5 text-[0.875rem] text-fg font-normal">{item.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-fg-subtle hover:text-fg transition p-0.5 rounded-[4px] -mr-1 -mt-1"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
