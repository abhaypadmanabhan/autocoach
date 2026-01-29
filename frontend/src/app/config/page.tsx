"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { School, X, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useCreateSession } from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";

function ConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const { document, loading: docLoading } = useDocument(documentId);
  const { createSession, creating, error: sessionError } = useCreateSession();
  
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const focusOptions = [
    { id: "key-concepts", label: "Key Concepts" },
    { id: "everything", label: "Everything" },
    { id: "practice", label: "Practice Problems" }
  ];

  const timeOptions = [
    { id: "15min", label: "15 min", questions: 5 },
    { id: "30min", label: "30 min", questions: 10 },
    { id: "60min", label: "60 min", questions: 20 }
  ];

  useEffect(() => {
    if (!documentId) {
      router.push("/upload");
    }
  }, [documentId, router]);

  const handleStartQuiz = async () => {
    if (!documentId || !selectedTime) return;
    const timeOption = timeOptions.find(t => t.id === selectedTime);
    if (!timeOption) return;

    try {
      const session = await createSession({
        document_id: documentId,
        num_questions: timeOption.questions,
        difficulty: "medium",
        question_types: ["mcq", "true_false", "free_text"]
      });
      router.push(`/session?session_id=${session.session_id}`);
    } catch (err) {
      // Error handled by hook
    }
  };

  if (docLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-sans antialiased flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-background-light/80 border-b border-gray-200 px-6 py-4">
        <div className="max-w-[700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <School size={20} />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">AutoCoach</h2>
          </div>
          <button onClick={() => router.push("/dashboard")} className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
            <X className="text-slate-500" size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[700px] mx-auto px-4 py-8 pb-32 flex flex-col gap-8">
        {document && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-slate-text">Document</p>
            <p className="font-medium text-indigo-space truncate">{document.filename}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 h-10 shrink-0 border border-gray-100 bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold">AC</div>
            <div className="flex flex-col gap-1 items-start max-w-[85%]">
              <span className="text-primary text-xs font-medium ml-1">AutoCoach</span>
              <div className="p-4 rounded-2xl rounded-bl-sm bg-white shadow-sm border border-gray-100">
                <p className="text-slate-800 leading-relaxed">Hi there! What focus area should we cover today?</p>
              </div>
            </div>
          </div>
          <div className="pl-14 flex flex-wrap gap-2">
            {focusOptions.map((option) => (
              <button key={option.id} onClick={() => setSelectedFocus(option.id)} className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${selectedFocus === option.id ? "bg-primary text-white border-primary shadow-md" : "bg-white border-gray-200 text-slate-600 hover:border-primary hover:text-primary"}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {selectedFocus && (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 h-10 shrink-0 border border-gray-100 bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold">AC</div>
              <div className="flex flex-col gap-1 items-start max-w-[85%]">
                <span className="text-primary text-xs font-medium ml-1">AutoCoach</span>
                <div className="p-4 rounded-2xl rounded-bl-sm bg-white shadow-sm border border-gray-100">
                  <p className="text-slate-800 leading-relaxed">Got it. How much time do you have?</p>
                </div>
              </div>
            </div>
            <div className="pl-14 flex flex-wrap gap-2">
              {timeOptions.map((option) => (
                <button key={option.id} onClick={() => setSelectedTime(option.id)} className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${selectedTime === option.id ? "bg-primary text-white border-primary shadow-md" : "bg-white border-gray-200 text-slate-600 hover:border-primary hover:text-primary"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedFocus && selectedTime && (
          <div className="flex flex-col gap-6 mt-2">
            <div className="flex items-end gap-3">
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-10 h-10 shrink-0 border border-gray-100 bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold">AC</div>
              <div className="flex flex-col gap-1 items-start max-w-[85%]">
                <div className="p-4 rounded-2xl rounded-bl-sm bg-white shadow-sm border border-gray-100">
                  <p className="text-slate-800 leading-relaxed">Excellent! I have prepared a custom quiz. Click below to start!</p>
                </div>
              </div>
            </div>
            <div className="pl-14 pt-2">
              <button 
                onClick={handleStartQuiz} 
                disabled={creating}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
              >
                {creating ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                {creating ? "Creating..." : "Start Quiz"}
              </button>
              {sessionError && <p className="text-red-500 text-sm mt-2">{sessionError}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ConfigChat() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <ConfigContent />
    </Suspense>
  );
}
