"use client";

import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface StatusBadgeProps {
  status: "pending" | "processing" | "ready" | "error" | "failed" | "uploading" | string;
  pulse?: boolean;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Clock;
}> = {
  pending: {
    label: "Pending",
    color: "#94a3b8",
    bgColor: "rgba(148, 163, 184, 0.1)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    color: "#eab308",
    bgColor: "rgba(234, 179, 8, 0.1)",
    borderColor: "rgba(234, 179, 8, 0.3)",
    icon: Loader2,
  },
  ready: {
    label: "Ready",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    icon: CheckCircle2,
  },
  error: {
    label: "Error",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    icon: XCircle,
  },
  failed: {
    label: "Failed",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    icon: XCircle,
  },
  uploading: {
    label: "Uploading",
    color: "#cd776a",
    bgColor: "rgba(205, 119, 106, 0.1)",
    borderColor: "rgba(205, 119, 106, 0.3)",
    icon: Loader2,
  },
};

// Fallback config for unknown statuses
const fallbackConfig = {
  label: "Unknown",
  color: "#94a3b8",
  bgColor: "rgba(148, 163, 184, 0.1)",
  borderColor: "rgba(148, 163, 184, 0.3)",
  icon: AlertCircle,
};

export function StatusBadge({
  status,
  pulse = false,
  className = "",
  showIcon = true,
}: StatusBadgeProps) {
  const config = statusConfig[status] || fallbackConfig;
  const Icon = config.icon;
  const shouldPulse = pulse && (status === "processing" || status === "uploading");

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
        text-xs font-medium border
        ${className}
      `}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.color,
      }}
    >
      {showIcon && (
        <span className="flex-shrink-0">
          {shouldPulse ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Icon size={14} />
            </motion.span>
          ) : (
            <Icon size={14} />
          )}
        </span>
      )}
      <span>{config.label}</span>
      {shouldPulse && (
        <span className="relative flex h-2 w-2 ml-1">
          <motion.span
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.color }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: config.color }}
          />
        </span>
      )}
    </motion.span>
  );
}

interface ProcessingIndicatorProps {
  text?: string;
  className?: string;
}

export function ProcessingIndicator({
  text = "Processing...",
  className = "",
}: ProcessingIndicatorProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full"
      />
      <span className="text-text-secondary text-sm">{text}</span>
    </div>
  );
}

interface ProgressDotsProps {
  className?: string;
}

export function ProgressDots({ className = "" }: ProgressDotsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
          className="w-2 h-2 rounded-full bg-brand-primary"
        />
      ))}
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  progress,
  className = "",
  showPercentage = false,
  size = "md",
}: ProgressBarProps) {
  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full ${sizeClasses[size]} bg-surface-border/30 rounded-full overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
          className="h-full bg-brand-primary rounded-full"
        />
      </div>
      {showPercentage && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-text-muted">Progress</span>
          <span className="text-xs text-brand-primary font-medium">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}
