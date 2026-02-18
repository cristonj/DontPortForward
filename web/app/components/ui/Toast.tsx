"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 3;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components outside provider — just log
    return { toast: (msg, type) => console.warn(`[toast:${type || 'info'}] ${msg}`) };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      // Trim oldest if over max
      if (next.length > MAX_TOASTS) {
        const removed = next.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(removed.id);
          }
        }
      }
      return next;
    });

    const timer = setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

const typeStyles: Record<ToastType, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  error: "border-red-500/40 bg-red-500/10 text-red-300",
  info: "border-blue-500/40 bg-blue-500/10 text-blue-300",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-xl shadow-2xl text-sm font-mono animate-in slide-in-from-bottom-2 ${typeStyles[toast.type]}`}
      role="alert"
    >
      <span className="flex-1 min-w-0 break-words">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-current"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
