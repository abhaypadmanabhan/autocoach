"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { overlayVariants, modalVariants } from "@/lib/motions";

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: "danger" | "default";
}

export function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  variant = "default",
}: ConfirmModalProps) {
  const isDanger = variant === "danger";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onCancel}
            className="absolute inset-0 bg-surface-dark/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl"
          >
            {/* Icon */}
            {isDanger && (
              <div className="w-12 h-12 rounded-full bg-semantic-error/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-semantic-error" />
              </div>
            )}

            {/* Title */}
            <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
              {title}
            </h2>

            {/* Message */}
            <p className="text-text-secondary text-center mb-6">{message}</p>

            {/* Actions */}
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                disabled={isLoading}
                className="
                  flex-1 py-3 px-4 rounded-xl
                  bg-surface-border/50 text-text-primary
                  font-medium
                  hover:bg-surface-border transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {cancelText}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                disabled={isLoading}
                className={`
                  flex-1 py-3 px-4 rounded-xl
                  font-medium flex items-center justify-center gap-2
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isDanger
                      ? "bg-semantic-error text-white hover:bg-semantic-error/90"
                      : "bg-brand-primary text-surface-dark hover:bg-brand-primary/90"
                  }
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  confirmText
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
