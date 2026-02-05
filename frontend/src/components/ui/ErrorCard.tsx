"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Lock,
  Shield,
  Search,
  Clock,
  Server,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  X,
} from "lucide-react";
import { accordionVariants, slideUpItem } from "@/lib/motions";
import { getErrorDisplay, type ErrorDisplay } from "@/lib/errorMessages";
import { ApiError } from "@/lib/types";

const ICON_MAP = {
  lock: Lock,
  shield: Shield,
  search: Search,
  clock: Clock,
  server: Server,
  alert: AlertCircle,
} as const;

interface ErrorCardProps {
  error: ApiError | Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorCard({
  error,
  onRetry,
  onDismiss,
  className = "",
}: ErrorCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const display: ErrorDisplay = getErrorDisplay(error);
  const IconComponent = ICON_MAP[display.icon];

  const hasDetails =
    error instanceof ApiError && (error.code || error.details || error.status);

  return (
    <motion.div
      variants={slideUpItem}
      initial="hidden"
      animate="show"
      className={`
        rounded-2xl border border-semantic-error/30 bg-semantic-error/5
        p-6 ${className}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-semantic-error/10 flex items-center justify-center">
          <IconComponent size={24} className="text-semantic-error" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text-primary mb-1">
            {display.title}
          </h3>
          <p className="text-text-secondary">{display.message}</p>

          {/* Expandable Details */}
          {hasDetails && (
            <div className="mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                <motion.span
                  animate={{ rotate: showDetails ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={16} />
                </motion.span>
                Details
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    variants={accordionVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-3 rounded-lg bg-surface-darker text-sm font-mono text-text-muted">
                      {error instanceof ApiError && (
                        <>
                          <p>Status: {error.status}</p>
                          {error.code && <p>Code: {error.code}</p>}
                          {error.details && (
                            <p className="mt-2 break-all">
                              {typeof error.details === "string"
                                ? error.details
                                : JSON.stringify(error.details, null, 2)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Actions */}
          {(onRetry || onDismiss) && (
            <div className="mt-4 flex items-center gap-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors text-sm font-medium"
                >
                  <RefreshCw size={16} />
                  Retry
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-border/50 text-text-secondary hover:bg-surface-border transition-colors text-sm font-medium"
                >
                  <X size={16} />
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
