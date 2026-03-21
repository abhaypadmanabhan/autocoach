"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Play,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import {
  slideUpItem,
  scaleItem,
  buttonHoverVariants,
} from "@/lib/motions";
import type { Document } from "@/lib/types";
import type { DocumentProgress } from "@/hooks/useDocumentProgress";

// ── DocumentStatusBadge ─────────────────────────────────────────────

function DocumentStatusBadge({
  status,
  pulse,
}: {
  status: string;
  pulse?: boolean;
}) {
  let variant: "success" | "destructive" | "secondary" | "processing" =
    "secondary";
  let label = "Pending";
  let Icon = Clock;

  switch (status) {
    case "processing":
      variant = "processing";
      label = "Processing";
      Icon = Loader2;
      break;
    case "ready":
      variant = "success";
      label = "Ready";
      Icon = CheckCircle2;
      break;
    case "error":
    case "failed":
      variant = "destructive";
      label = status === "failed" ? "Failed" : "Error";
      Icon = XCircle;
      break;
  }

  return (
    <motion.div variants={scaleItem} initial="hidden" animate="show">
      <Badge variant={variant} className="gap-1 rounded-full py-1">
        <Icon
          size={12}
          className={cn(status === "processing" && "animate-spin")}
        />
        {label}
        {pulse && status === "processing" && (
          <span className="relative flex h-2 w-2 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
        )}
      </Badge>
    </motion.div>
  );
}

// ── DocumentCard ────────────────────────────────────────────────────

export interface DocumentCardProps {
  document: Document;
  progress?: DocumentProgress;
  onContinue?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "ready":
      return {
        accentColor: "var(--pop-coral)",
        iconColor: "text-[var(--pop-coral)]",
        iconBg: "bg-[var(--pop-coral)]/10",
      };
    case "processing":
      return {
        accentColor: "var(--pop-gold)",
        iconColor: "text-[var(--pop-gold)]",
        iconBg: "bg-[var(--pop-gold)]/10",
      };
    default:
      return {
        accentColor: "var(--text-muted)",
        iconColor: "text-[var(--text-muted)]",
        iconBg: "bg-[var(--surface-border)]",
      };
  }
}

export function DocumentCard({
  document,
  progress,
  onContinue,
  onDelete,
  isDeleting,
}: DocumentCardProps) {
  const config = getStatusConfig(document.status);

  const masteryPercent = progress?.mastery_percent ?? document.progress ?? 0;
  const milestone = progress?.milestone;
  const showMilestone = milestone && milestone !== "none";

  return (
    <motion.div
      variants={slideUpItem}
      className={cn(
        "relative rounded-2xl border border-[var(--surface-border)]",
        "bg-[var(--surface-card)]/40 backdrop-blur-sm",
        "transition-all duration-300 group",
        "hover:border-[var(--pop-coral)]/30 hover-lift card-glow",
        "overflow-hidden"
      )}
    >
      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.accentColor}, transparent)`,
        }}
      />

      {/* Hover glow effect */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
          "bg-gradient-to-br from-[var(--pop-coral)]/5 via-transparent to-[var(--pop-gold)]/5"
        )}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              config.iconBg,
              config.iconColor
            )}
          >
            <FileText size={20} />
          </div>
          <div className="flex items-center gap-2">
            <DocumentStatusBadge
              status={document.status}
              pulse={document.status === "processing"}
            />
            <motion.button
              variants={buttonHoverVariants}
              initial="initial"
              whileHover="hover"
              whileTap="tap"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              disabled={isDeleting}
              className={cn(
                "p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100",
                document.status === "failed"
                  ? "text-[var(--semantic-error)] hover:bg-[var(--semantic-error)]/10"
                  : "text-[var(--text-muted)] hover:text-[var(--semantic-error)] hover:bg-[var(--semantic-error)]/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Delete document"
            >
              {isDeleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1 line-clamp-1 font-heading">
          {document.ai_title || document.filename}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          {(document.file_size / 1024 / 1024).toFixed(1)} MB
        </p>

        {/* Progress Section */}
        {document.status === "ready" && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)]">Mastery</span>
              <span className="text-[var(--pop-coral)] font-bold">
                {Math.round(masteryPercent)}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-[var(--surface-border)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${masteryPercent}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)]"
              />
            </div>
            {showMilestone && (
              <p className="text-[10px] text-[var(--pop-gold)]">
                {milestone === "100" ? "Mastered!" : `${milestone}% milestone`}
              </p>
            )}
          </div>
        )}

        {/* Processing state */}
        {document.status === "processing" && (
          <div className="space-y-2">
            <div className="h-1 rounded-full bg-[var(--surface-border)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--pop-gold)] animate-pulse w-2/3" />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Analyzing document...</p>
          </div>
        )}

        {/* Action */}
        {document.status === "ready" && (
          <motion.button
            onClick={onContinue}
            variants={buttonHoverVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className={cn(
              "mt-4 w-full py-2.5 rounded-xl",
              "bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)]",
              "text-white font-semibold text-sm",
              "flex items-center justify-center gap-2",
              "hover:shadow-lg hover:shadow-[var(--pop-coral)]/20 transition-all"
            )}
          >
            <Play size={16} />
            Study
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
