"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { School, CheckCircle, Trophy, Loader2, ArrowLeft } from "lucide-react";
import { useSession } from "@/hooks/useQuiz";

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { session, loading, error } = useSession(sessionId);

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard");
    }
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light">
        <p className="text-gray-500">Session not found</p>
        <Link href="/dashboard" className="mt-4 text-primary hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const score = session.score_percentage || 0;
  const correct = session.correct_answers;
  const total = session.total_questions;

  return (
    <div className="bg-background-light dark:bg-background-dark font-sans text-indigo-dark dark:text-background-light min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-border bg-white/95 backdrop-blur-sm px-4 md:px-10 py-3">
        <div className="flex items-center gap-4 text-indigo-dark cursor-pointer" onClick={() => router.push("/dashboard")}>
          <div className="text-primary"><School size={28} /></div>
          <h2 className="text-lg font-bold">AutoCoach</h2>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[960px] mx-auto px-4 py-8 md:px-6 md:py-12 flex flex-col gap-10">
        <section className="relative flex flex-col items-center justify-center gap-8 py-4">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-indigo-dark tracking-tight">Session Complete!</h1>
            <p className="text-slate-text text-lg font-medium">Great job on completing the quiz!</p>
          </div>
          
          <div className="relative size-48 md:size-56">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-border" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
              <motion.path 
                initial={{ strokeDasharray: "0, 100" }}
                animate={{ strokeDasharray: `${score}, 100` }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                className="text-primary drop-shadow-lg" 
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                fill="none" 
                stroke="currentColor" 
                strokeLinecap="round" 
                strokeWidth="3"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 1 }}
                className="text-5xl md:text-6xl font-extrabold text-indigo-dark tracking-tighter"
              >
                {Math.round(score)}%
              </motion.span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 w-full">
            <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-slate-border">
              <div className="bg-green-100 p-2 rounded-full text-green-600 flex items-center justify-center">
                <CheckCircle className="fill-green-600 text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-text font-semibold uppercase tracking-wider">Correct</p>
                <p className="text-lg font-bold text-indigo-dark leading-none">{correct}/{total}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-slate-border">
              <div className="bg-primary/10 p-2 rounded-full text-primary flex items-center justify-center">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-text font-semibold uppercase tracking-wider">Score</p>
                <p className="text-lg font-bold text-indigo-dark leading-none">{Math.round(score)}%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sticky bottom-4 z-40 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-border flex flex-col sm:flex-row gap-4 justify-between items-center mt-4">
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-indigo-dark">Want to study more?</p>
          </div>
          <div className="flex w-full sm:w-auto gap-3">
            <Link href="/dashboard" className="flex-1 sm:flex-none px-6 py-3 rounded-lg border border-slate-border text-indigo-dark font-semibold hover:bg-gray-50 transition-all text-center flex items-center gap-2">
              <ArrowLeft size={18} /> Dashboard
            </Link>
            <Link href={`/config?document_id=${session.document_id}`} className="flex-1 sm:flex-none px-6 py-3 rounded-lg bg-primary text-white font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
              Study Again
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Results() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
