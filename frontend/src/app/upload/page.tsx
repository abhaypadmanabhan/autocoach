"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import {
  CloudUpload,
  FolderOpen,
  Loader2,
  CheckCircle,
  FileText,
  X,
  ArrowLeft,
} from "lucide-react";
import { usePollDocumentStatus } from "@/hooks/useDocuments";
import { useUploadDocument } from "@/hooks/useUploadDocument";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { ErrorBanner } from "@/components/ui/Skeleton";
import { DiamondSpinner } from "@/components/ui/DiamondButton";
import { ProgressDots, ProgressBar } from "@/components/ui/StatusBadge";
import { staggerContainer, slideUpItem, dropZoneVariants, circularRevealVariants } from "@/lib/motions";
import { ActivationBanner } from "@/components/activation/ActivationBanner";

export default function Upload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const { upload, error: uploadError, uploading, stage, progress } = useUploadDocument();
  const { document } = usePollDocumentStatus(documentId);

  const handleReset = useCallback(() => {
    setUploadedFile(null);
    setDocumentId(null);
  }, []);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  // Redirect when ready
  useEffect(() => {
    if (document?.status === "ready") {
      const timeout = setTimeout(() => {
        if (document.session_id) {
          router.push(`/session?session_id=${document.session_id}`);
        } else {
          router.push(`/config?document_id=${document.id}`);
        }
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [document?.status, document?.id, document?.session_id, router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploadedFile(file);
    try {
      const result = await upload(file);
      setDocumentId(result.id);
    } catch {
      // Error handled by hook
    }
  }, [upload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
  }, [handleUpload]);

  const getStatusMessage = () => {
    // Show upload stages first (before document is registered)
    if (!documentId) {
      switch (stage) {
        case "uploading":
          return "Uploading to storage...";
        case "registering":
          return "Registering document...";
        case "error":
          return "Upload failed";
        default:
          return "Preparing...";
      }
    }
    // Then show document processing status
    if (!document) return "Waiting to process...";
    switch (document.status) {
      case "pending":
        return "Queued for processing...";
      case "processing":
        return "Analyzing your document...";
      case "ready":
        return "Ready! Redirecting...";
      case "failed":
        return "Processing failed";
      default:
        return "Processing...";
    }
  };

  const getStatusColor = () => {
    if (!document) return "text-brand-primary";
    switch (document.status) {
      case "ready":
        return "text-semantic-success";
      case "failed":
        return "text-semantic-error";
      default:
        return "text-brand-primary";
    }
  };

  return (
    <AppShell showBack backHref="/dashboard" title="Upload Document">
      <PageContainer size="md">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="py-8"
        >
          {/* Header */}
          <motion.div variants={slideUpItem} className="text-center mb-12">
            <h1 className="text-h1 font-serif text-text-primary mb-4">
              What do you want to study?
            </h1>
            <p className="text-text-secondary text-lg">
              Drop your PDF or PowerPoint and we&apos;ll create a custom quiz for you
            </p>
          </motion.div>

          {/* Upload Area */}
          <motion.div variants={slideUpItem}>
            <motion.div
              variants={dropZoneVariants}
              initial="idle"
              animate={isDragging ? "dragOver" : "idle"}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploadedFile && window.document.getElementById("file-input")?.click()}
              className={`
                relative border-2 border-dashed rounded-3xl
                p-12 md:p-16
                flex flex-col items-center justify-center
                cursor-pointer transition-all duration-300
                ${isDragging
                  ? "border-brand-primary bg-brand-primary/5 scale-[1.02]"
                  : "border-surface-border bg-surface-card hover:border-brand-primary/50"
                }
                ${uploadedFile ? "pointer-events-none" : ""}
              `}
            >
              <input
                type="file"
                id="file-input"
                className="hidden"
                accept=".pdf,.pptx"
                onChange={handleFileSelect}
              />

              <AnimatePresence mode="wait">
                {!uploadedFile ? (
                  <motion.div
                    key="upload-prompt"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    {/* Animated cloud icon */}
                    <motion.div
                      animate={{ y: isDragging ? -10 : [0, -5, 0] }}
                      transition={{
                        duration: isDragging ? 0.2 : 2,
                        repeat: isDragging ? 0 : Infinity,
                        ease: "easeInOut",
                      }}
                      className={`
                        w-20 h-20 rounded-full mx-auto mb-6
                        flex items-center justify-center
                        ${isDragging ? "bg-brand-primary/20" : "bg-surface-dark"}
                        transition-colors duration-300
                      `}
                    >
                      <CloudUpload
                        size={40}
                        className={isDragging ? "text-brand-primary" : "text-brand-secondary"}
                      />
                    </motion.div>

                    <h3 className="text-xl font-semibold text-text-primary mb-2">
                      {isDragging ? "Drop your file here" : "Drag & drop your file"}
                    </h3>
                    <p className="text-text-muted mb-8">
                      or <span className="text-brand-primary">click to browse</span>
                    </p>

                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <FileText size={16} />
                      <span>Supports PDF, PPTX</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="uploading"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                  >
                    {document?.status === "ready" ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-20 h-20 rounded-full bg-semantic-success/20 flex items-center justify-center mx-auto mb-6"
                      >
                        <CheckCircle size={40} className="text-semantic-success" />
                      </motion.div>
                    ) : document?.status === "failed" || uploadError ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-20 h-20 rounded-full bg-semantic-error/20 flex items-center justify-center mx-auto mb-6"
                      >
                        <X size={40} className="text-semantic-error" />
                      </motion.div>
                    ) : (
                      <div className="mx-auto mb-6">
                        <DiamondSpinner size="lg" />
                      </div>
                    )}

                    <h3 className="text-xl font-semibold text-text-primary mb-2">
                      {uploadedFile.name}
                    </h3>
                    <p className="text-text-muted text-sm mb-4">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    <div className="flex items-center justify-center gap-3 mb-4">
                      <p className={`font-medium ${getStatusColor()}`}>
                        {getStatusMessage()}
                      </p>
                      {document?.status !== "ready" && document?.status !== "failed" && !uploadError && (
                        <ProgressDots />
                      )}
                    </div>

                    {uploadError && (
                      <p className="text-semantic-error text-sm mt-2">
                        {uploadError}
                      </p>
                    )}

                    {/* Progress bar during upload or processing */}
                    {(uploading || document?.status === "processing") && (
                      <div className="w-64 mx-auto mt-4">
                        <ProgressBar
                          progress={uploading ? progress : 60}
                          size="sm"
                        />
                      </div>
                    )}

                    {/* Retry button for failed uploads */}
                    {(document?.status === "failed" || uploadError) && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={handleReset}
                        className="mt-6 px-6 py-3 rounded-xl border-2 border-surface-border text-text-primary font-semibold hover:bg-surface-card transition-colors"
                      >
                        Try Another File
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* Tips */}
          <motion.div
            variants={slideUpItem}
            className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              {
                icon: "📄",
                title: "Clear documents",
                description: "PDFs with clear text work best",
              },
              {
                icon: "📊",
                title: "Presentations",
                description: "PowerPoint files are supported too",
              },
              {
                icon: "⚡",
                title: "Fast processing",
                description: "Usually takes less than a minute",
              },
            ].map((tip, index) => (
              <motion.div
                key={tip.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-center p-4"
              >
                <div className="text-3xl mb-3">{tip.icon}</div>
                <h4 className="font-semibold text-text-primary mb-1">{tip.title}</h4>
                <p className="text-sm text-text-muted">{tip.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Activation CTA - show once per document */}
          {document?.status === "ready" && documentId && (
            <ActivationBanner documentId={documentId} sessionId={document.session_id} />
          )}
        </motion.div>
      </PageContainer>
    </AppShell>
  );
}
