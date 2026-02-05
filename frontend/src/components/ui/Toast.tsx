"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";
import { ToastContext, useToastState, type Toast } from "@/hooks/useToast";
import type { ReactNode } from "react";

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variantStyles = {
    success: "bg-semantic-success/10 border-semantic-success/30 text-semantic-success",
    error: "bg-semantic-error/10 border-semantic-error/30 text-semantic-error",
    warning: "bg-semantic-warning/10 border-semantic-warning/30 text-semantic-warning",
  };

  const icons = {
    success: <CheckCircle size={20} className="flex-shrink-0" />,
    error: <XCircle size={20} className="flex-shrink-0" />,
    warning: <AlertTriangle size={20} className="flex-shrink-0" />,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
        backdrop-blur-md border
        ${variantStyles[toast.type]}
      `}
    >
      {icons[toast.type]}
      <p className="text-sm font-medium text-text-primary flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg hover:bg-surface-border/50 transition-colors text-text-muted"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { toasts, showToast, dismissToast } = useToastState();

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
