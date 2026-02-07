"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  ArrowRight, 
  Check, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  Target, 
  Lock,
  ChevronRight,
  Brain,
  BarChart3,
  Zap
} from "lucide-react";
import { useCreateSession } from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { useToast } from "@/hooks/useToast";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { ErrorBanner, Skeleton } from "@/components/ui/Skeleton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Difficulty, QuestionType } from "@/lib/types";

const STEPS = [
  { id: "focus", label: "Focus", description: "What to study" },
  { id: "questions", label: "Questions", description: "How many" },
  { id: "difficulty", label: "Difficulty", description: "Challenge level" },
  { id: "types", label: "Types", description: "Question formats" },
];

const QUESTION_COUNTS = [5, 10, 15, 20];
const TIMER_OPTIONS = [
  { value: null, label: "No timer" },
  { value: 60, label: "1 min" },
  { value: 180, label: "3 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
];
const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode }[] = [
  { value: "mcq", label: "Multiple Choice", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "true_false", label: "True / False", icon: <Check className="w-4 h-4" /> },
  { value: "free_text", label: "Free Text", icon: <Brain className="w-4 h-4" /> },
];

function ConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const { document, loading: docLoading, error: docError } = useDocument(documentId);
  const { concepts, isLoading: conceptsLoading, error: conceptsError, refetch: refetchConcepts } = useDocumentConcepts(documentId);
  const { createSession, creating, error: sessionError } = useCreateSession();
  const { showToast } = useToast();

  const focusConceptIdFromUrl = searchParams.get("focus");

  const [currentStep, setCurrentStep] = useState(0);
  const [studyMode, setStudyMode] = useState<"recommended" | "custom">("recommended");
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["mcq", "true_false"]);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  const urlFocusConcept = useSyncExternalStore(
    () => () => {},
    () => {
      if (!focusConceptIdFromUrl || concepts.length === 0) return null;
      const valid = concepts.find(c => c.id === focusConceptIdFromUrl);
      return valid ? focusConceptIdFromUrl : null;
    },
    () => null
  );

  useEffect(() => {
    if (urlFocusConcept && !selectedConceptIds.includes(urlFocusConcept)) {
      setSelectedConceptIds([urlFocusConcept]);
      setStudyMode("custom");
    }
  }, [urlFocusConcept]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!documentId) {
      router.push("/upload");
    }
  }, [documentId, router]);

  const handleNext = () => {
    if (currentStep === 0) {
      if (studyMode === "custom" && selectedConceptIds.length === 0) {
        showToast("Please select at least one topic", "warning");
        return;
      }
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartQuiz = async () => {
    if (!documentId || questionTypes.length === 0) return;

    try {
      const session = await createSession({
        document_id: documentId,
        num_questions: numQuestions,
        difficulty,
        question_types: questionTypes,
        focus_concept_ids: studyMode === "custom" ? selectedConceptIds : undefined,
      });

      const timerParam = timerSeconds ? `&t=${timerSeconds}` : "";
      router.push(`/session?session_id=${session.session_id}${timerParam}`);
    } catch {
      // Error handled by hook
    }
  };

  const toggleQuestionType = (type: QuestionType) => {
    setQuestionTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  if (docLoading) {
    return (
      <PageContainer size="lg">
        <div className="py-8">
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (docError || (!docLoading && !document && documentId)) {
    return (
      <PageContainer size="md">
        <div className="py-16 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 rounded-full bg-semantic-error/20 flex items-center justify-center mx-auto mb-6"
          >
            <AlertCircle size={40} className="text-semantic-error" />
          </motion.div>
          <h2 className="text-h2 font-serif text-text-primary mb-2">Document Not Found</h2>
          <p className="text-text-muted mb-6">
            {docError || "The document you're looking for doesn't exist or you don't have access to it."}
          </p>
          <Button asChild>
            <Link href="/upload">Upload a Document</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-8"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]">
            <Sparkles className="w-3 h-3 mr-1" />
            Configure Quiz
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-2 font-heading">
            Configure Your Quiz
          </h1>
          {document && (
            <p className="text-[var(--text-secondary)]">
              Setting up quiz for: <span className="text-[var(--brand-primary)] font-medium">{document.filename}</span>
            </p>
          )}
        </div>

        {/* Stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-center">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <motion.div 
                  className={cn(
                    "flex flex-col items-center cursor-pointer",
                    index <= currentStep ? "opacity-100" : "opacity-50"
                  )}
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  whileHover={index < currentStep ? { scale: 1.05 } : {}}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                    index < currentStep 
                      ? "bg-[var(--brand-primary)] text-[var(--surface-dark)]"
                      : index === currentStep
                        ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border-2 border-[var(--brand-primary)]"
                        : "bg-[var(--surface-card)] text-[var(--text-muted)] border-2 border-[var(--surface-border)]"
                  )}>
                    {index < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 font-medium",
                    index === currentStep ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]"
                  )}>
                    {step.label}
                  </span>
                </motion.div>
                {index < STEPS.length - 1 && (
                  <div className="w-16 md:w-24 h-0.5 mx-2 bg-[var(--surface-border)]">
                    <motion.div 
                      className="h-full bg-[var(--brand-primary)]"
                      initial={{ width: "0%" }}
                      animate={{ width: index < currentStep ? "100%" : "0%" }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] mb-6">
          <CardContent className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {/* Step 1: Focus */}
              {currentStep === 0 && (
                <motion.div
                  key="step-focus"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-heading">What should we focus on?</h2>
                    <p className="text-[var(--text-secondary)]">Choose how you want to study</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card 
                      className={cn(
                        "cursor-pointer transition-all",
                        studyMode === "recommended" 
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5" 
                          : "border-[var(--surface-border)] hover:border-[var(--text-secondary)]/50"
                      )}
                      onClick={() => setStudyMode("recommended")}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-[var(--brand-primary)]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)]">Recommended</h3>
                          <p className="text-sm text-[var(--text-muted)]">Smart mix based on your mastery</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card 
                      className={cn(
                        "cursor-pointer transition-all",
                        studyMode === "custom" 
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5" 
                          : "border-[var(--surface-border)] hover:border-[var(--text-secondary)]/50"
                      )}
                      onClick={() => setStudyMode("custom")}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-secondary)]/10 flex items-center justify-center">
                          <Target className="w-5 h-5 text-[var(--brand-secondary)]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)]">Pick Topics</h3>
                          <p className="text-sm text-[var(--text-muted)]">Focus on specific concepts</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {studyMode === "custom" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">Select up to 3 topics</p>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          selectedConceptIds.length === 3
                            ? "bg-[var(--semantic-warning)]/10 text-[var(--semantic-warning)]"
                            : "bg-[var(--surface-darker)] text-[var(--text-muted)]"
                        )}>
                          {selectedConceptIds.length}/3
                        </span>
                      </div>

                      {conceptsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-14 w-full rounded-lg" />
                          ))}
                        </div>
                      ) : conceptsError ? (
                        <ErrorCard error={conceptsError} onRetry={() => refetchConcepts()} />
                      ) : concepts.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-muted)] bg-[var(--surface-darker)]/50 rounded-lg border border-dashed border-[var(--surface-border)]">
                          No concepts found for this document.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                          {concepts.map(concept => {
                            const isSelected = selectedConceptIds.includes(concept.id);
                            const isCore = concept.is_core;
                            const isDisabled = !isCore;

                            return (
                              <motion.div
                                key={concept.id}
                                whileHover={!isDisabled ? { x: 4 } : {}}
                                onClick={() => {
                                  if (isDisabled) return;
                                  if (isSelected) {
                                    setSelectedConceptIds(prev => prev.filter(id => id !== concept.id));
                                  } else {
                                    if (selectedConceptIds.length >= 3) {
                                      showToast("Maximum 3 concepts allowed", "warning");
                                      return;
                                    }
                                    setSelectedConceptIds(prev => [...prev, concept.id]);
                                  }
                                }}
                                className={cn(
                                  "p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer",
                                  isDisabled
                                    ? "opacity-50 border-[var(--surface-border)] bg-[var(--surface-darker)]"
                                    : isSelected
                                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
                                      : "border-[var(--surface-border)] hover:border-[var(--text-secondary)]/50 bg-[var(--surface-card)]"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                    isSelected
                                      ? "bg-[var(--brand-primary)] border-[var(--brand-primary)]"
                                      : "border-[var(--text-muted)]"
                                  )}>
                                    {isSelected && <Check size={12} className="text-white" />}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-[var(--text-primary)]">{concept.concept_name}</p>
                                    {isDisabled && (
                                      <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                        <Lock size={10} />
                                        Unlock by mastering core concepts
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {concept.mastery_score !== null && concept.mastery_score > 0 ? (
                                    <span className={cn(
                                      "text-xs font-mono font-medium",
                                      concept.mastery_score > 80 ? "text-[var(--semantic-success)]" : "text-[var(--brand-primary)]"
                                    )}>
                                      {concept.mastery_score}%
                                    </span>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] border-[var(--brand-secondary)]/30 text-[var(--brand-secondary)]">
                                      NEW
                                    </Badge>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Questions */}
              {currentStep === 1 && (
                <motion.div
                  key="step-questions"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-heading">How many questions?</h2>
                    <p className="text-[var(--text-secondary)]">Choose the number of questions for your quiz</p>
                  </div>

                  <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
                    {QUESTION_COUNTS.map((count) => (
                      <motion.button
                        key={count}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setNumQuestions(count)}
                        className={cn(
                          "py-3 px-4 rounded-lg font-semibold transition-all",
                          numQuestions === count
                            ? "bg-[var(--brand-primary)] text-[var(--surface-dark)]"
                            : "bg-[var(--surface-darker)] text-[var(--text-secondary)] hover:bg-[var(--surface-card)] border border-[var(--surface-border)]"
                        )}
                      >
                        {count}
                      </motion.button>
                    ))}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setNumQuestions(25)}
                      className={cn(
                        "py-3 px-4 rounded-lg font-semibold transition-all",
                        !QUESTION_COUNTS.includes(numQuestions)
                          ? "bg-[var(--brand-primary)] text-[var(--surface-dark)]"
                          : "bg-[var(--surface-darker)] text-[var(--text-secondary)] hover:bg-[var(--surface-card)] border border-[var(--surface-border)]"
                      )}
                    >
                      Custom
                    </motion.button>
                  </div>

                  {!QUESTION_COUNTS.includes(numQuestions) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      <label className="text-sm text-[var(--text-muted)]">Custom number (3-50)</label>
                      <input
                        type="number"
                        min={3}
                        max={50}
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(parseInt(e.target.value) || 10)}
                        className="w-full max-w-xs px-4 py-3 rounded-lg bg-[var(--surface-darker)] border border-[var(--surface-border)] text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Difficulty */}
              {currentStep === 2 && (
                <motion.div
                  key="step-difficulty"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-heading">Choose difficulty</h2>
                    <p className="text-[var(--text-secondary)]">Select the challenge level for your quiz</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                      <motion.div
                        key={level}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDifficulty(level)}
                        className={cn(
                          "cursor-pointer rounded-xl p-5 border-2 transition-all",
                          difficulty === level
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                            : "border-[var(--surface-border)] hover:border-[var(--text-secondary)]/50 bg-[var(--surface-card)]"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "font-bold text-lg capitalize",
                            difficulty === level ? "text-[var(--brand-primary)]" : "text-[var(--text-primary)]"
                          )}>
                            {level}
                          </span>
                          {difficulty === level && (
                            <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)] flex items-center justify-center">
                              <Check size={14} className="text-[var(--surface-dark)]" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">
                          {level === "easy" && "Basic recall and understanding"}
                          {level === "medium" && "Application and analysis"}
                          {level === "hard" && "Complex problem solving"}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Types */}
              {currentStep === 3 && (
                <motion.div
                  key="step-types"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-heading">Question types</h2>
                    <p className="text-[var(--text-secondary)]">Select the types of questions you want</p>
                  </div>

                  <div className="space-y-3">
                    {QUESTION_TYPES.map(({ value, label, icon }) => (
                      <motion.div
                        key={value}
                        whileHover={{ x: 4 }}
                        onClick={() => toggleQuestionType(value)}
                        className={cn(
                          "cursor-pointer rounded-xl p-4 border-2 transition-all flex items-center justify-between",
                          questionTypes.includes(value)
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                            : "border-[var(--surface-border)] hover:border-[var(--text-secondary)]/50 bg-[var(--surface-card)]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            questionTypes.includes(value) 
                              ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]" 
                              : "bg-[var(--surface-darker)] text-[var(--text-muted)]"
                          )}>
                            {icon}
                          </div>
                          <span className={cn(
                            "font-medium",
                            questionTypes.includes(value) ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                          )}>
                            {label}
                          </span>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          questionTypes.includes(value)
                            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]"
                            : "border-[var(--surface-border)]"
                        )}>
                          {questionTypes.includes(value) && <Check size={14} className="text-[var(--surface-dark)]" />}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {questionTypes.length === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[var(--semantic-error)] text-sm"
                    >
                      Please select at least one question type
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>

          <div className="flex items-center gap-3">
            {sessionError && (
              <p className="text-[var(--semantic-error)] text-sm">
                {getErrorMessage(sessionError)}
              </p>
            )}

            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                Continue
                <ChevronRight size={18} className="ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleStartQuiz}
                disabled={creating || questionTypes.length === 0}
                className="shadow-lg shadow-[var(--brand-primary)]/20"
              >
                {creating ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="mr-2" />
                    Start Quiz
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </PageContainer>
  );
}

// Need to add Link import
import Link from "next/link";

export default function ConfigPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="h-[80vh] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          </div>
        }
      >
        <ConfigContent />
      </Suspense>
    </AppShell>
  );
}
