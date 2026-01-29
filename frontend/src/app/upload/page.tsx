"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { School, LayoutDashboard, PlusCircle, CloudUpload, FolderOpen, FileText, Loader2, CheckCircle } from "lucide-react";
import { useUploadDocument, usePollDocumentStatus } from "@/hooks/useDocuments";

export default function Upload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const { upload, uploading, error: uploadError, progress } = useUploadDocument();
  const { document, isPolling } = usePollDocumentStatus(documentId);

  useEffect(() => {
    if (document?.status === "ready") {
      const timeout = setTimeout(() => {
        router.push(`/config?document_id=${document.id}`);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [document?.status, document?.id, router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleUpload(files[0]);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setUploadedFile(file);
    try {
      const result = await upload(file);
      setDocumentId(result.id);
    } catch (err) {
      // Error handled by hook
    }
  };

  const getStatusMessage = () => {
    if (!document) return "Uploading...";
    switch (document.status) {
      case "pending": return "Waiting to process...";
      case "processing": return "Processing document...";
      case "ready": return "Ready! Redirecting...";
      case "failed": return "Processing failed";
      default: return "Processing...";
    }
  };

  const getStatusColor = () => {
    if (!document) return "text-primary";
    switch (document.status) {
      case "ready": return "text-green-500";
      case "failed": return "text-red-500";
      default: return "text-primary";
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-indigo-space dark:text-gray-100 overflow-hidden h-screen flex font-sans">
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-64 h-full hidden md:flex flex-col border-r border-slate-border dark:border-gray-800 bg-white dark:bg-[#251a18]"
      >
        <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
          <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <School size={24} />
          </motion.div>
          <h1 className="text-xl font-bold tracking-tight">AutoCoach</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-text dark:text-gray-400 hover:bg-background-light rounded-lg transition-all">
            <LayoutDashboard size={22} />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link href="/upload" className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-lg transition-all">
            <PlusCircle size={22} className="fill-primary/20" />
            <span className="font-medium">New Study</span>
          </Link>
        </nav>
      </motion.aside>

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto">
        <header className="h-16 border-b border-slate-border dark:border-gray-800 bg-white dark:bg-[#251a18] flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-medium text-slate-text dark:text-gray-400">Upload Documents</h2>
        </header>
        
        <div className="flex-1 p-8 flex flex-col items-center justify-start">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-4xl">
            <div className="mb-8 text-center md:text-left">
              <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="text-3xl md:text-4xl font-black tracking-tight text-indigo-space dark:text-white mb-2">
                What do you want to study?
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-slate-text dark:text-gray-400 text-lg">
                Supported formats: PDF, PPTX
              </motion.p>
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }} className="bg-white dark:bg-[#251a18] rounded-xl shadow-sm border border-slate-border dark:border-gray-800 p-8 md:p-12 mb-10 transition-all duration-300 hover:shadow-md">
              <motion.div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                animate={{ borderColor: isDragging ? "#cd776a" : "rgba(205, 119, 106, 0.3)", backgroundColor: isDragging ? "rgba(205, 119, 106, 0.05)" : "rgba(248, 246, 246, 0.5)" }}
                className="border-2 border-dashed border-primary/30 dark:border-primary/20 bg-background-light/50 dark:bg-black/20 rounded-xl flex flex-col items-center justify-center py-16 px-4 text-center transition-all cursor-pointer min-h-[300px]"
                onClick={() => !uploadedFile && window.document.getElementById("file-input")?.click()}
              >
                <input type="file" id="file-input" className="hidden" accept=".pdf,.pptx" onChange={handleFileSelect} />
                
                {!uploadedFile ? (
                  <>
                    <motion.div animate={{ y: isDragging ? -5 : 0 }} transition={{ type: "spring", stiffness: 300 }} className="h-16 w-16 bg-white dark:bg-gray-800 rounded-full shadow-sm flex items-center justify-center mb-6 text-primary">
                      <CloudUpload size={36} />
                    </motion.div>
                    <h3 className="text-xl font-bold text-indigo-space dark:text-white mb-2">{isDragging ? "Drop your file here" : "Drag & drop your PDF or PPTX"}</h3>
                    <p className="text-slate-text dark:text-gray-400 mb-8 max-w-sm mx-auto">or click to browse files from your computer</p>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-all flex items-center gap-2" onClick={(e) => { e.stopPropagation(); window.document.getElementById("file-input")?.click(); }}>
                      <FolderOpen size={20} /> Browse Files
                    </motion.button>
                  </>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                    {document?.status === "ready" ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600">
                        <CheckCircle size={32} />
                      </motion.div>
                    ) : (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-16 w-16 text-primary mb-4">
                        <Loader2 size={64} />
                      </motion.div>
                    )}
                    <h3 className="text-xl font-bold text-indigo-space dark:text-white mb-1">{uploadedFile.name}</h3>
                    <p className="text-slate-text dark:text-gray-400 text-sm mb-2">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className={`text-sm font-medium ${getStatusColor()}`}>{getStatusMessage()}</p>
                    {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
