"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Loader2, AlertTriangle, Sparkles, FileText, TrendingUp, Clock, Trash2 } from "lucide-react";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { useDocumentProgressSummary } from "@/hooks/useDocumentProgress";
import { useToast } from "@/hooks/useToast";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { DocumentSidebar } from "@/components/sidebar/DocumentSidebar";
import { DocumentDashboard } from "@/components/dashboard/DocumentDashboard";
import { DailySprintCard } from "@/components/dashboard/DailySprintCard";
import { WeakConceptsWidget } from "@/components/dashboard/WeakConceptsWidget";
import { DocumentCard } from "@/components/features/dashboard/DocumentCard";
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
import { cn } from "@/lib/utils";
import { staggerContainer, slideUpItem } from "@/lib/motions";
import { DashboardSkeleton } from "@/components/features/dashboard/DashboardSkeleton";
import { ErrorBanner } from "@/components/features/dashboard/ErrorBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User } from "@supabase/supabase-js";
import type { Document } from "@/lib/types";

import { Suspense } from "react";

function DashboardContent() {
  const router = useRouter();
  const { documents, loading, error, refetch } = useDocuments();
  const { summary: progressSummary } = useDocumentProgressSummary();
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

  // Helper to get progress for a doc
  const getProgress = (docId: string) => {
    return progressSummary?.documents.find(p => p.document_id === docId);
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

  // Derived state
  const totalDocuments = documents.length;
  const readyDocuments = documents.filter((d) => d.status === "ready").length;
  const processingDocuments = documents.filter((d) => d.status === "processing").length;
  const recentDocument = documents.find((d) => d.status === "ready");

  // Get active document from URL
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  if (loading || userLoading) return <DashboardSkeleton />;

  return (
    <AppShell sidebar={<DocumentSidebar />}>
      {docId ? (
        <DocumentDashboard documentId={docId} />
      ) : (
        <PageContainer size="xl">
          <div className={cn("space-y-8")}>
            {/* Hero Section */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col md:flex-row md:items-end justify-between gap-6"
            >
              <motion.div variants={slideUpItem}>
                <Badge variant="outline" className="mb-4 px-3 py-1 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Welcome Back
                </Badge>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-2 font-heading">
                  Ready to learn?
                </h1>
                <p className="text-[var(--text-secondary)] text-lg">
                  Welcome back, <span className="text-[var(--brand-primary)] font-medium">{user?.email?.split("@")[0] || "Student"}</span>
                </p>
              </motion.div>

              <motion.div variants={slideUpItem}>
                <Button asChild size="lg" className="shadow-lg shadow-[var(--brand-primary)]/20">
                  <Link href="/upload">
                    <Plus size={20} className="mr-2" />
                    Study New
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Daily Sprint */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="w-full"
            >
              <motion.div variants={slideUpItem}>
                <DailySprintCard />
              </motion.div>
            </motion.div>

            {/* Weak Concepts Loop */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="w-full"
            >
              <WeakConceptsWidget />
            </motion.div>

            {/* Stats Grid */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <motion.div variants={slideUpItem}>
                <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] hover:border-[var(--brand-primary)]/30 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                      Total Documents
                    </CardTitle>
                    <FileText className="w-4 h-4 text-[var(--brand-primary)]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{totalDocuments}</div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={slideUpItem}>
                <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] hover:border-[var(--semantic-success)]/30 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                      Ready to Study
                    </CardTitle>
                    <TrendingUp className="w-4 h-4 text-[var(--semantic-success)]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{readyDocuments}</div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={slideUpItem}>
                <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] hover:border-[var(--brand-secondary)]/30 transition-all">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                      Processing
                    </CardTitle>
                    <Clock className="w-4 h-4 text-[var(--brand-secondary)]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{processingDocuments}</div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Continue Learning */}
            {recentDocument && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={slideUpItem}>
                  <Card className="bg-gradient-to-br from-[var(--surface-card)] to-[var(--surface-darker)] border-[var(--surface-border)]">
                    <CardHeader>
                      <CardTitle className="text-lg font-heading">Continue Learning</CardTitle>
                      <CardDescription>Pick up where you left off</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[var(--brand-primary)]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{recentDocument.ai_title || recentDocument.filename}</p>
                          <p className="text-sm text-[var(--text-muted)]">Ready to quiz</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" asChild>
                          <Link href={`/dashboard?docId=${recentDocument.id}`}>
                            View
                          </Link>
                        </Button>
                        <Button asChild>
                          <Link href={`/config?document_id=${recentDocument.id}&mode=recommend`}>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Start Quiz
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Documents Grid */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={slideUpItem}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] font-heading">Your Documents</h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/upload">View All</Link>
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-full bg-[var(--surface-darker)] flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-[var(--text-muted)]" />
                      </div>
                      <p className="text-[var(--text-muted)] mb-4">No documents yet</p>
                      <Button asChild>
                        <Link href="/upload">
                          <Plus className="w-4 h-4 mr-2" />
                          Upload First Document
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.slice(0, 6).map((doc, index) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
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
