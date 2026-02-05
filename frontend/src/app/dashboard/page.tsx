"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Plus,
  FileText,
  Play,
  Loader2,
  BookOpen,
  Trophy,
  Sparkles,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { useToast } from "@/hooks/useToast";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer, Section } from "@/components/layout/AppShell";
import { Badge } from "@/components/primitives/Badge";
import { Progress } from "@/components/primitives/Progress";
import { Skeleton } from "@/components/primitives/Skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/primitives/Modal";
import { staggerContainer, slideUpItem } from "@/lib/motions";
import type { User } from "@supabase/supabase-js";
import type { Document } from "@/lib/types";

// — Inline helpers (page-specific, built on primitives) ——————————————

function DocumentStatusBadge({ status, pulse }: { status: string; pulse?: boolean }) {
  let variant: "success" | "destructive" | "secondary" | "processing" = "secondary";
  let label = "Pending";
  let Icon = Clock;

  switch (status) {
    case "processing":
      variant = "processing"; label = "Processing"; Icon = Loader2; break;
    case "ready":
      variant = "success"; label = "Ready"; Icon = CheckCircle2; break;
    case "error":
    case "failed":
      variant = "destructive"; label = status === "failed" ? "Failed" : "Error"; Icon = XCircle; break;
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <Badge variant={variant} className="gap-1.5 rounded-full py-1.5">
        <Icon size={14} className={status === "processing" ? "animate-spin" : ""} />
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

function StatCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-surface-card border border-surface-border">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

function DocumentCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl border-2 border-surface-border bg-surface-card">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30 flex items-center justify-between gap-4">
      <p className="text-sm text-semantic-error">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-semantic-error hover:underline whitespace-nowrap">
          Retry
        </button>
      )}
    </div>
  );
}

// Document Card Component
interface DocumentCardProps {
  document: Document;
  onContinue?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function DocumentCard({ document, onContinue, onDelete, isDeleting }: DocumentCardProps) {
  const getStatusConfig = () => {
    switch (document.status) {
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
  };

  const config = getStatusConfig();

  return (
    <motion.div
      variants={slideUpItem}
      initial="initial"
      whileHover="hover"
      animate="initial"
      className={`
        relative p-6 rounded-2xl border-2 bg-surface-card
        transition-all duration-300
        ${config.borderColor}
      `}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${config.bgGradient} opacity-50`} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-surface-dark ${config.iconColor}`}>
            <FileText size={24} />
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              disabled={isDeleting}
              className={`
                p-2 rounded-lg transition-colors
                ${document.status === "failed"
                  ? "text-semantic-error hover:bg-semantic-error/10"
                  : "text-text-muted hover:text-semantic-error hover:bg-semantic-error/10"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title="Delete document"
            >
              {isDeleting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </motion.button>
            <DocumentStatusBadge status={document.status} pulse={document.status === "processing"} />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-1">
          {document.filename}
        </h3>
        <p className="text-sm text-text-muted mb-4">
          {(document.file_size / 1024 / 1024).toFixed(2)} MB • {document.chunk_count || 0} chunks
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="
              w-full py-3 px-4 rounded-xl
              bg-brand-primary text-surface-dark
              font-semibold flex items-center justify-center gap-2
              hover:bg-brand-primary/90 transition-colors
            "
          >
            <Play size={18} />
            Start Quiz
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// Empty State Component
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center py-16 px-4"
    >
      {/* Decorative shapes */}
      <div className="relative w-32 h-32 mx-auto mb-8">
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-brand-primary/10"
        />
        <motion.div
          animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
          className="absolute inset-4 rounded-2xl bg-surface-card border-2 border-surface-border flex items-center justify-center"
        >
          <BookOpen size={40} className="text-surface-border" />
        </motion.div>
      </div>

      <h3 className="text-h2 font-serif text-text-primary mb-3">
        No documents yet
      </h3>
      <p className="text-text-secondary mb-8 max-w-md mx-auto">
        Upload your first PDF or PowerPoint presentation to start studying with AI-generated quizzes.
      </p>

      <motion.button
        onClick={onUpload}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="
          inline-flex items-center gap-2 px-8 py-4 rounded-full
          bg-brand-primary text-surface-dark
          font-semibold text-lg
          hover:bg-brand-primary/90 transition-colors
          animate-pulse-cta
        "
      >
        <Plus size={24} />
        Upload Document
      </motion.button>
    </motion.div>
  );
}

// Main Dashboard Component
export default function Dashboard() {
  const router = useRouter();
  const { documents, loading, error, refetch } = useDocuments();
  const { deleteDocument, deleting } = useDeleteDocument();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      await deleteDocument(documentToDelete.id);
      showToast("Document deleted successfully", "success");
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
    } catch {
      showToast("Failed to delete document", "error");
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setDocumentToDelete(null);
  };

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setUserLoading(false);
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Stats
  const totalDocuments = documents.length;
  const readyDocuments = documents.filter((d) => d.status === "ready").length;
  const processingDocuments = documents.filter((d) => d.status === "processing").length;

  const recentDocument = documents.find((d) => d.status === "ready");

  if (loading || userLoading) {
    return (
      <AppShell>
        <PageContainer>
          {/* Skeleton Hero */}
          <Section spacing="sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="h-10 w-48 bg-surface-border/50 rounded animate-pulse mb-2" />
                <div className="h-6 w-32 bg-surface-border/50 rounded animate-pulse" />
              </div>
              <div className="h-12 w-32 bg-surface-border/50 rounded-full animate-pulse" />
            </div>
          </Section>
          {/* Skeleton Stats */}
          <Section spacing="sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          </Section>
          {/* Skeleton Documents */}
          <Section>
            <div className="h-8 w-40 bg-surface-border/50 rounded animate-pulse mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DocumentCardSkeleton />
              <DocumentCardSkeleton />
              <DocumentCardSkeleton />
            </div>
          </Section>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        {/* Hero Section */}
        <Section spacing="sm">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col md:flex-row md:items-end justify-between gap-6"
          >
            <motion.div variants={slideUpItem}>
              <h1 className="text-h1 font-serif text-text-primary mb-2">
                Ready to learn?
              </h1>
              <p className="text-text-secondary text-lg">
                Welcome back, {user?.email?.split("@")[0] || "Student"}
              </p>
            </motion.div>

            <motion.div variants={slideUpItem}>
              <Link
                href="/upload"
                className="
                  inline-flex items-center gap-2 px-6 py-3 rounded-full
                  bg-brand-primary text-surface-dark
                  font-semibold
                  hover:bg-brand-primary/90 transition-all
                  hover:shadow-lg hover:shadow-brand-primary/20
                "
              >
                <Plus size={20} />
                Study New
              </Link>
            </motion.div>
          </motion.div>
        </Section>

        {/* Stats Grid */}
        <Section spacing="sm">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <motion.div
              variants={slideUpItem}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="p-6 rounded-2xl bg-surface-card border border-surface-border"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <BookOpen size={24} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-text-primary">{totalDocuments}</p>
                  <p className="text-sm text-text-muted uppercase tracking-wider">Documents</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={slideUpItem}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="p-6 rounded-2xl bg-surface-card border border-surface-border"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-semantic-success/10 flex items-center justify-center text-semantic-success">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-text-primary">{readyDocuments}</p>
                  <p className="text-sm text-text-muted uppercase tracking-wider">Ready</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={slideUpItem}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="p-6 rounded-2xl bg-surface-card border border-surface-border"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-text-primary">{processingDocuments}</p>
                  <p className="text-sm text-text-muted uppercase tracking-wider">Processing</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* Documents Grid */}
        <Section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 font-serif text-text-primary">Your Documents</h2>
              <Link
                href="/upload"
                className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors font-medium"
              >
                View all
              </Link>
            </div>

            {documents.length === 0 ? (
              <EmptyState onUpload={() => router.push("/upload")} />
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
                    onContinue={() => router.push(`/config?document_id=${doc.id}`)}
                    onDelete={() => handleDeleteClick(doc)}
                    isDeleting={deleting && documentToDelete?.id === doc.id}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </Section>

        {/* Continue Learning Section */}
        {recentDocument && (
          <Section spacing="sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-transparent border border-brand-primary/30"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-brand-primary/20 flex items-center justify-center text-brand-primary">
                  <Trophy size={32} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-brand-primary uppercase tracking-wider font-medium mb-1">
                    Continue Learning
                  </p>
                  <h3 className="text-xl font-semibold text-text-primary mb-2">
                    {recentDocument.filename}
                  </h3>
                  <p className="text-text-secondary">
                    Ready to study • {recentDocument.chunk_count || 0} chunks
                  </p>
                </div>
                <motion.button
                  onClick={() => router.push(`/config?document_id=${recentDocument.id}`)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="
                    px-6 py-3 rounded-xl
                    bg-brand-primary text-surface-dark
                    font-semibold flex items-center gap-2
                    hover:bg-brand-primary/90 transition-colors
                    whitespace-nowrap
                  "
                >
                  <Play size={18} />
                  Continue
                </motion.button>
              </div>
            </motion.div>
          </Section>
        )}

        {error && (
          <Section spacing="sm">
            <ErrorBanner
              message={`Failed to load documents: ${error}`}
              onRetry={() => refetch()}
            />
          </Section>
        )}

        {/* Delete Confirmation Modal */}
        <AlertDialog open={deleteModalOpen} onOpenChange={(open) => { if (!open) handleDeleteCancel(); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="w-12 h-12 rounded-full bg-semantic-error/10 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={24} className="text-semantic-error" />
              </div>
              <AlertDialogTitle className="text-center">Delete Document</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Are you sure you want to delete &quot;{documentToDelete?.filename}&quot;? This will also delete all associated quiz sessions and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
                className="bg-semantic-error text-white hover:bg-semantic-error/90"
              >
                {deleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppShell>
  );
}
