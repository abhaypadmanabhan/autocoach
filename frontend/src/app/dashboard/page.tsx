"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { useDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { useToast } from "@/hooks/useToast";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
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
import { StatsGrid } from "@/components/features/dashboard/StatsGrid";
import { ContinueLearning } from "@/components/features/dashboard/ContinueLearning";
import { DocumentsGrid } from "@/components/features/dashboard/DocumentsGrid";
import { DashboardSkeleton } from "@/components/features/dashboard/DashboardSkeleton";
import { ErrorBanner } from "@/components/features/dashboard/ErrorBanner";
import type { User } from "@supabase/supabase-js";
import type { Document } from "@/lib/types";

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

  // Derived state
  const totalDocuments = documents.length;
  const readyDocuments = documents.filter((d) => d.status === "ready").length;
  const processingDocuments = documents.filter((d) => d.status === "processing").length;
  const recentDocument = documents.find((d) => d.status === "ready");

  if (loading || userLoading) return <DashboardSkeleton />;

  return (
    <AppShell>
      <PageContainer>
        <div className={cn("space-y-8")}>
          {/* Hero */}
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
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                  "bg-brand-primary text-surface-dark",
                  "font-semibold",
                  "hover:bg-brand-primary/90 transition-all",
                  "hover:shadow-lg hover:shadow-brand-primary/20"
                )}
              >
                <Plus size={20} />
                Study New
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <StatsGrid
            totalDocuments={totalDocuments}
            readyDocuments={readyDocuments}
            processingDocuments={processingDocuments}
          />

          {/* Continue Learning */}
          {recentDocument && (
            <ContinueLearning
              document={recentDocument}
              onContinue={() => router.push(`/config?document_id=${recentDocument.id}`)}
            />
          )}

          {/* Documents */}
          <DocumentsGrid
            documents={documents}
            onContinue={(id) => router.push(`/config?document_id=${id}`)}
            onDelete={handleDeleteClick}
            deletingId={deleting && documentToDelete ? documentToDelete.id : null}
            onUpload={() => router.push("/upload")}
          />

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
    </AppShell>
  );
}
