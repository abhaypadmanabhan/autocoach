"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Loader2, AlertTriangle, Sparkles, FileText } from "lucide-react";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { useDocumentProgressSummary } from "@/hooks/useDocumentProgress";
import { useToast } from "@/hooks/useToast";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { DocumentSidebar } from "@/components/sidebar/DocumentSidebar";
import { DocumentDashboard } from "@/components/dashboard/DocumentDashboard";
import { WeakConceptsWidget } from "@/components/dashboard/WeakConceptsWidget";
import { ReviewTodayWidget } from "@/components/dashboard/ReviewTodayWidget";
import { DocumentCard } from "@/components/features/dashboard/DocumentCard";
import { StatsGrid } from "@/components/features/dashboard/StatsGrid";
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
import { DashboardSkeleton } from "@/components/features/dashboard/DashboardSkeleton";
import { ErrorBanner } from "@/components/features/dashboard/ErrorBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Document } from "@/lib/types";
import { Suspense } from "react";

function DashboardContent() {
  const router = useRouter();
  const { documents, loading, error, refetch } = useDocuments();
  const { summary: progressSummary } = useDocumentProgressSummary();
  const { deleteDocument, deleting } = useDeleteDocument();
  const { showToast } = useToast();
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

  const getProgress = (docId: string) => {
    return progressSummary?.documents.find(p => p.document_id === docId);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserLoading(false);
    };
    checkAuth();
  }, [router]);

  const totalDocuments = documents.length;
  const readyDocuments = documents.filter((d) => d.status === "ready").length;
  const processingDocuments = documents.filter((d) => d.status === "processing").length;
  const recentDocument = documents.find((d) => d.status === "ready");

  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  if (loading || userLoading) return <DashboardSkeleton />;

  return (
    <AppShell sidebar={<DocumentSidebar />}>
      {docId ? (
        <DocumentDashboard documentId={docId} />
      ) : (
        <PageContainer size="xl">
          <div className="space-y-10">

            {/* Hero Section - Minimal & Bold */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col md:flex-row md:items-end justify-between gap-6"
            >
              <motion.div variants={slideUpItem} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--pop-coral)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--pop-coral)]" />
                  </span>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium bg-[var(--pop-coral)]/10 text-[var(--pop-coral)] border-none">
                    Welcome back
                  </Badge>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--text-primary)] font-heading tracking-tight">
                  Ready to{" "}
                  <span className="gradient-text-warm">learn?</span>
                </h1>
                <p className="text-[var(--text-secondary)] text-base">
                  Keep your streak alive. Your documents are waiting.
                </p>
              </motion.div>

              <motion.div variants={slideUpItem}>
                <Button asChild size="lg" className="bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)] text-white hover:shadow-lg hover:shadow-[var(--pop-coral)]/20 font-semibold px-6">
                  <Link href="/upload">
                    <Plus size={18} className="mr-2" />
                    Study New
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <motion.div variants={slideUpItem}>
                <StatsGrid
                  totalDocuments={totalDocuments}
                  readyDocuments={readyDocuments}
                  processingDocuments={processingDocuments}
                />
              </motion.div>
            </motion.div>

            {/* Continue Learning - Inline minimal */}
            {recentDocument && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={slideUpItem}>
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)]/30 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[var(--pop-coral)]/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[var(--pop-coral)]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] font-heading line-clamp-1">
                          {recentDocument.ai_title || recentDocument.filename}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">Ready to study</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard?docId=${recentDocument.id}`}>
                          View
                        </Link>
                      </Button>
                      <Button size="sm" asChild className="bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)] text-white hover:shadow-lg hover:shadow-[var(--pop-coral)]/20">
                        <Link href={`/dashboard?docId=${recentDocument.id}`}>
                          <Sparkles className="w-4 h-4 mr-1.5" />
                          Start
                        </Link>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Smart Review */}
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <ReviewTodayWidget />
            </motion.div>

            {/* Weak Concepts Loop */}
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <WeakConceptsWidget />
            </motion.div>

            {/* Documents Section */}
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <motion.div variants={slideUpItem}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] font-heading">
                    Your Documents
                  </h2>
                  <Button variant="ghost" size="sm" asChild className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <Link href="/upload">View all</Link>
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-card)]/20 backdrop-blur-sm p-12 text-center">
                    <div className="absolute inset-0 warm-aurora-bg-subtle" />
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-card)]/50 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-[var(--text-muted)]" />
                      </div>
                      <p className="text-[var(--text-muted)] mb-4">No documents yet</p>
                      <Button asChild size="lg" className="bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)] text-white hover:shadow-lg hover:shadow-[var(--pop-coral)]/20 font-semibold">
                        <Link href="/upload">
                          <Plus className="w-4 h-4 mr-2" />
                          Upload First Document
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.slice(0, 6).map((doc, index) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.4 }}
                      >
                        <DocumentCard
                          document={doc}
                          progress={getProgress(doc.id)}
                          onContinue={() => router.push(`/dashboard?docId=${doc.id}`)}
                          onDelete={() => handleDeleteClick(doc)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>

            {/* Error */}
            {error && (
              <ErrorBanner
                message={`Failed to load documents: ${error}`}
                onRetry={() => refetch()}
              />
            )}
          </div>

          {/* Delete Confirmation Modal */}
          <AlertDialog open={deleteModalOpen} onOpenChange={(open) => { if (!open) handleDeleteCancel(); }}>
            <AlertDialogContent className="bg-[var(--surface-card)] border-[var(--surface-border)]">
              <AlertDialogHeader>
                <div className="w-12 h-12 rounded-full bg-[var(--semantic-error)]/10 flex items-center justify-center mx-auto mb-2">
                  <AlertTriangle size={24} className="text-[var(--semantic-error)]" />
                </div>
                <AlertDialogTitle className="text-center text-[var(--text-primary)]">Delete Document</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-[var(--text-secondary)]">
                  Are you sure you want to delete &quot;{documentToDelete?.filename}&quot;? This will also delete all associated quiz sessions and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting} className="bg-[var(--surface-card)] border-[var(--surface-border)] text-[var(--text-primary)]">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
                  className="bg-[var(--semantic-error)] text-white hover:bg-[var(--semantic-error)]/90"
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
      )}
    </AppShell>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
