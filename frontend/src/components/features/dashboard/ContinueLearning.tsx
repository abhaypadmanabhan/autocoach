"use client";

import { motion } from "framer-motion";
import { Trophy, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { slideUpItem, buttonHoverVariants } from "@/lib/motions";
import type { Document } from "@/lib/types";

interface ContinueLearningProps {
  document: Document;
  onContinue: () => void;
}

export function ContinueLearning({
  document,
  onContinue,
}: ContinueLearningProps) {
  return (
    <motion.div
      variants={slideUpItem}
      initial="hidden"
      animate="show"
      className={cn(
        "p-6 rounded-2xl",
        "bg-gradient-to-br from-brand-primary/10 to-transparent",
        "border border-brand-primary/30"
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <div
          className={cn(
            "w-16 h-16 rounded-2xl",
            "bg-brand-primary/20 flex items-center justify-center",
            "text-brand-primary"
          )}
        >
          <Trophy size={32} />
        </div>
        <div className="flex-1">
          <p
            className={cn(
              "text-sm text-brand-primary uppercase tracking-wider",
              "font-medium mb-1"
            )}
          >
            Continue Learning
          </p>
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            {document.filename}
          </h3>
          <p className="text-text-secondary">
            Ready to study &bull; {document.chunk_count || 0} chunks
          </p>
        </div>
        <motion.button
          onClick={onContinue}
          variants={buttonHoverVariants}
          initial="initial"
          whileHover="hover"
          whileTap="tap"
          className={cn(
            "px-6 py-3 rounded-xl",
            "bg-brand-primary text-surface-dark",
            "font-semibold flex items-center gap-2",
            "hover:bg-brand-primary/90 transition-colors",
            "whitespace-nowrap"
          )}
        >
          <Play size={18} />
          Continue
        </motion.button>
      </div>
    </motion.div>
  );
}
