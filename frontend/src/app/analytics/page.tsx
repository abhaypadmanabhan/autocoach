"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { School, BookOpen, Clock, Trophy, TrendingUp, FileText, CalendarClock, ArrowLeft, Loader2 } from "lucide-react";
import { useDocument } from "@/hooks/useDocuments";

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const { document, loading, error } = useDocument(documentId);

  useEffect(() => {
    if (!documentId) {
      router.push("/dashboard");
    }
  }, [documentId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light">
        <p className="text-gray-500">Document not found</p>
        <Link href="/dashboard" className="mt-4 text-primary hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-gray-100 font-sans min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/dashboard")}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <BookOpen size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight text-indigo-dark">AutoCoach</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">Dashboard</Link>
              <span className="text-sm font-medium text-primary">Analytics</span>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <FileText size={40} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${document.status === "ready" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {document.status === "ready" ? "Ready" : document.status}
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-indigo-dark">{document.filename}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Uploaded on {new Date(document.created_at).toLocaleDateString()}
                  {document.chunk_count && ` • ${document.chunk_count} chunks`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="px-4 py-2 rounded-lg border border-slate-border text-indigo-dark font-medium hover:bg-gray-50 transition-all flex items-center gap-2">
                <ArrowLeft size={18} /> Back
              </Link>
              {document.status === "ready" && (
                <Link href={`/config?document_id=${document.id}`} className="px-4 py-2 rounded-lg bg-primary text-white font-bold hover:bg-primary-dark transition-all">
                  Start Quiz
                </Link>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[
              { icon: CalendarClock, label: "Status", value: document.status, color: "indigo" },
              { icon: Trophy, label: "File Type", value: document.file_type.toUpperCase(), color: "yellow" },
              { icon: Clock, label: "File Size", value: `${(document.file_size / 1024 / 1024).toFixed(2)} MB`, color: "blue" },
              { icon: TrendingUp, label: "Chunks", value: document.chunk_count?.toString() || "--", color: "green" }
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${stat.color === "indigo" ? "bg-indigo-50 text-indigo-600" : stat.color === "yellow" ? "bg-yellow-50 text-yellow-600" : stat.color === "blue" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
                    <stat.icon size={20} />
                  </div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-indigo-dark">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-indigo-dark mb-4">Document Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Document ID</p>
                <p className="font-medium text-indigo-dark font-mono text-sm">{document.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created At</p>
                <p className="font-medium text-indigo-dark">{new Date(document.created_at).toLocaleString()}</p>
              </div>
              {document.page_count && (
                <div>
                  <p className="text-sm text-gray-500">Pages</p>
                  <p className="font-medium text-indigo-dark">{document.page_count}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Analytics() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
