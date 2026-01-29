"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { School, Timer, FileText, ArrowRight, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useSession, useSubmitAnswer, useCurrentQuestion } from "@/hooks/useQuiz";

function SessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  
  const { session, loading: sessionLoading, refetch } = useSession(sessionId);
  const { question, loading: questionLoading, refetch: refetchQuestion } = useCurrentQuestion(sessionId);
  const { submitAnswer, submitting, error: submitError } = useSubmitAnswer(sessionId);
  
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard");
    }
  }, [sessionId, router]);

  const handleSubmit = async () => {
    if (!question || selectedOption === null) return;
    
    const answer = question.options ? question.options[selectedOption] : String(selectedOption);
    
    try {
      const result = await submitAnswer(question.question_id, answer);
      setLastResult(result.result);
      setShowFeedback(true);
      
      if (result.session_complete) {
        setTimeout(() => {
          router.push(`/results?session_id=${sessionId}`);
        }, 2000);
      } else if (result.next_question) {
        setTimeout(() => {
          setShowFeedback(false);
          setSelectedOption(null);
          refetchQuestion();
          refetch();
        }, 2000);
      }
    } catch (err) {
      // Error handled by hook
    }
  };

  if (sessionLoading || questionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-light">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-indigo-space">Session Complete!</h2>
        <button onClick={() => router.push(`/results?session_id=${sessionId}`)} className="mt-4 px-6 py-3 bg-primary text-white rounded-lg font-semibold">
          View Results
        </button>
      </div>
    );
  }

  const progress = session ? ((session.answered_questions / session.total_questions) * 100) : 0;

  return (
    <div className="bg-background-light dark:bg-background-dark text-indigo-space dark:text-gray-100 min-h-screen flex flex-col font-sans">
      <header className="w-full bg-white dark:bg-surface-dark border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
                <School size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">AutoCoach</h2>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full bg-white/50 border-b border-gray-200 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 min-w-[140px]">
              <span className="text-gray-400"><FileText size={20} /></span>
              <span className="font-medium text-gray-700">
                Question {question.question_number} of {question.total_questions}
              </span>
            </div>
            <div className="flex-1 w-full max-w-md mx-4">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-medium text-primary">{Math.round(progress)}% Complete</span>
              </div>
              <div className="w-full bg-almond rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full transition-all" style={{width: `${progress}%`}}></div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
              <Timer className="text-primary" size={20} />
              <span className="font-mono font-bold text-gray-900">--:--</span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 p-6 sm:p-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 to-primary"></div>
              
              <div className="flex mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-blue">
                  <CheckCircle size={16} />
                  {question.question_type === "mcq" ? "Multiple Choice" : question.question_type}
                </span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-10">
                {question.question_text}
              </h1>

              {showFeedback && lastResult ? (
                <div className={`p-6 rounded-xl mb-6 ${lastResult.is_correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-center gap-3 mb-2">
                    {lastResult.is_correct ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
                    <h3 className={`text-xl font-bold ${lastResult.is_correct ? "text-green-700" : "text-red-700"}`}>
                      {lastResult.is_correct ? "Correct!" : "Incorrect"}
                    </h3>
                  </div>
                  <p className="text-gray-700">{lastResult.feedback}</p>
                  <p className="text-sm text-gray-500 mt-2">Correct answer: {lastResult.correct_answer}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {question.options?.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedOption(i)}
                        className={`w-full text-left group flex items-center p-4 rounded-lg border-2 transition-all ${
                          selectedOption === i
                            ? "border-primary bg-primary/5"
                            : "border-gray-100 hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded font-semibold text-sm transition-colors ${
                          selectedOption === i ? "bg-primary text-white" : "bg-gray-100 text-gray-500 group-hover:bg-primary group-hover:text-white"
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="ml-4 text-lg text-gray-700 font-medium">{opt}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-10 flex justify-end">
                    <button 
                      onClick={handleSubmit}
                      disabled={selectedOption === null || submitting}
                      className={`inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold shadow-sm transition-all w-full sm:w-auto ${
                        selectedOption !== null && !submitting
                          ? "bg-primary text-white hover:bg-primary-dark"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {submitting ? <Loader2 className="animate-spin mr-2" size={20} /> : <ArrowRight className="ml-2" size={20} />}
                      {submitting ? "Submitting..." : "Submit Answer"}
                    </button>
                  </div>
                  {submitError && <p className="text-red-500 text-sm mt-2 text-right">{submitError}</p>}
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Progress</h3>
              <p className="text-2xl font-bold text-primary">{session?.correct_answers || 0} / {session?.answered_questions || 0}</p>
              <p className="text-sm text-gray-500">Correct answers</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Session() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
