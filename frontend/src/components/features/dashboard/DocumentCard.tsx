"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Play,
  Loader2,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import { Progress } from "@/components/primitives/Progress";
import {
  slideUpItem,
  scaleItem,
  buttonHoverVariants,
} from "@/lib/motions";
import type { Document } from "@/lib/types";

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
      <Badge variant={variant} className="gap-1.5 rounded-full py-1.5">
        <Icon
          size={14}
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
  onContinue?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "ready":
      return {
        borderColor: "border-brand-primary",
        bgGradient: "from-brand-primary/10 to-transparent",
        iconColor: "text-brand-primary",
      };
    case "processing":
      return {
        borderColor: "border-brand-secondary",
        bgGradient: "from-brand-secondary/10 to-transparent",
        iconColor: "text-brand-secondary",
      };
    default:
      return {
        borderColor: "border-surface-border",
        bgGradient: "from-surface-border/10 to-transparent",
        iconColor: "text-text-muted",
      };
  }
}

export function DocumentCard({
  document,
  onContinue,
  onDelete,
  isDeleting,
}: DocumentCardProps) {
  const config = getStatusConfig(document.status);

  return (
    <motion.div
      variants={slideUpItem}
      className={cn(
        "relative p-6 rounded-2xl border-2 bg-surface-card",
        "transition-all duration-300",
        config.borderColor
      )}
    >
      {/* Background gradient */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-50",
          config.bgGradient
        )}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              "bg-surface-dark",
              config.iconColor
            )}
          >
            <FileText size={24} />
          </div>
          <div className="flex items-center gap-2">
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
                "p-2 rounded-lg transition-colors",
                document.status === "failed"
                  ? "text-semantic-error hover:bg-semantic-error/10"
                  : "text-text-muted hover:text-semantic-error hover:bg-semantic-error/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Delete document"
            >
              {isDeleting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </motion.button>
            <DocumentStatusBadge
              status={document.status}
              pulse={document.status === "processing"}
            />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-1">
          {document.filename}
        </h3>
        <p className="text-sm text-text-muted mb-4">
          {(document.file_size / 1024 / 1024).toFixed(2)} MB &bull;{" "}
          {document.chunk_count || 0} chunks
        </p>

        {/* Processing state */}
        {document.status === "processing" && (
          <div className="mb-4">
            <Progress value={60} className="h-1" />
          </div>
        )}

        {/* Action button */}
        {document.status === "ready" && (
          <motion.button
            onClick={onContinue}
            variants={buttonHoverVariants}
            initial="initial"
            whileHover="hover"
            whileTap="tap"
            className={cn(
              "w-full py-3 px-4 rounded-xl",
              "bg-brand-primary text-surface-dark",
              "font-semibold flex items-center justify-center gap-2",
              "hover:bg-brand-primary/90 transition-colors"
            )}
          >
            <Play size={18} />
            Start Quiz
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
