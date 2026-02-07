"use client";

import { motion } from "framer-motion";
import { Plus, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { scaleItem, buttonHoverVariants } from "@/lib/motions";

interface EmptyStateProps {
  onUpload: () => void;
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <motion.div
      variants={scaleItem}
      initial="hidden"
      animate="show"
      className="text-center py-16 px-4"
    >
      {/* Static decorative element */}
      <div className="relative w-32 h-32 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full bg-brand-primary/10" />
        <div
          className={cn(
            "absolute inset-4 rounded-2xl bg-surface-card",
            "border-2 border-surface-border flex items-center justify-center"
          )}
        >
          <BookOpen size={40} className="text-surface-border" />
        </div>
      </div>

      <h3 className="text-h2 font-heading text-text-primary mb-3">
        No documents yet
      </h3>
      <p className="text-text-secondary mb-8 max-w-md mx-auto">
        Upload your first PDF or PowerPoint presentation to start studying with
        AI-generated quizzes.
      </p>

      <motion.button
        onClick={onUpload}
        variants={buttonHoverVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        className={cn(
          "inline-flex items-center gap-2 px-8 py-4 rounded-full",
          "bg-brand-primary text-surface-dark",
          "font-semibold text-lg",
          "hover:bg-brand-primary/90 transition-colors"
        )}
      >
        <Plus size={24} />
        Upload Document
      </motion.button>
    </motion.div>
  );
}
