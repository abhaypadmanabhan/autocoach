"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { staggerContainer } from "@/lib/motions";
import { DocumentCard } from "./DocumentCard";
import { EmptyState } from "./EmptyState";
import type { Document } from "@/lib/types";

interface DocumentsGridProps {
  documents: Document[];
  onContinue: (documentId: string) => void;
  onDelete: (document: Document) => void;
  deletingId: string | null;
  onUpload: () => void;
}

export function DocumentsGrid({
  documents,
  onContinue,
  onDelete,
  deletingId,
  onUpload,
}: DocumentsGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-h2 font-heading text-text-primary">
          Your Documents
        </h2>
        <Link
          href="/upload"
          className={cn(
            "text-sm text-brand-primary hover:text-brand-primary/80",
            "transition-colors font-medium"
          )}
        >
          View all
        </Link>
      </div>

      {documents.length === 0 ? (
        <EmptyState onUpload={onUpload} />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onContinue={() => onContinue(doc.id)}
              onDelete={() => onDelete(doc)}
              isDeleting={deletingId === doc.id}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
