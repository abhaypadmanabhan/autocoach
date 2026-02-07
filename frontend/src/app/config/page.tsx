"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Check, Clock, Sparkles, AlertCircle, Target, Lock } from "lucide-react";
import { useCreateSession } from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { useToast } from "@/hooks/useToast";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { ErrorBanner, Skeleton } from "@/components/ui/Skeleton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SetupStepper, StepContent } from "@/components/quiz/SetupStepper";
import { OptionPill, DifficultyCard, OptionPillGrid } from "@/components/ui/OptionPill";
import { DiamondButton } from "@/components/ui/DiamondButton";
import { staggerContainer, slideUpItem, stepExitVariants, stepEnterVariants } from "@/lib/motions";
import { cn } from "@/lib/utils";
import type { Difficulty, QuestionType, Concept } from "@/lib/types";

const STEPS = [
  { id: "focus", label: "Focus", description: "What to study" },
  { id: "questions", label: "Questions", description: "How many to generate" },
  { id: "difficulty", label: "Difficulty", description: "Choose your level" },
  { id: "types", label: "Types", description: "Question formats" },
  { id: "timer", label: "Timer", description: "Set time limit" },
];

const QUESTION_COUNTS = [5, 10, 15, 20];
const TIMER_OPTIONS = [
  { value: null, label: "No timer" },
  { value: 60, label: "1 min" },
  { value: 180, label: "3 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
];
const QUESTION_TYPES: { value: QuestionType; label: string; emoji: string }[] = [
  { value: "mcq", label: "Multiple Choice", emoji: "🔘" },
  { value: "true_false", label: "True / False", emoji: "✓" },
  { value: "free_text", label: "Free Text", emoji: "✏️" },
];

function ConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const { document, loading: docLoading, error: docError } = useDocument(documentId);
  const { concepts, isLoading: conceptsLoading, error: conceptsError, refetch: refetchConcepts } = useDocumentConcepts(documentId);
  const { createSession, creating, error: sessionError } = useCreateSession();
  const { showToast } = useToast();

  // Get focus concept from URL if present (from "Quiz this concept" link)
  const focusConceptIdFromUrl = searchParams.get("focus");

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [studyMode, setStudyMode] = useState<"recommended" | "custom">("recommended");
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["mcq", "true_false"]);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  // Track focus concept selection from URL using external store pattern
  // This avoids setState in effect while properly syncing with URL param
  const urlFocusConcept = useSyncExternalStore(
    () => () => {}, // No cleanup needed
    () => {
      // Client-side: validate and return focus concept if valid
      if (!focusConceptIdFromUrl || concepts.length === 0) return null;
      const valid = concepts.find(c => c.id === focusConceptIdFromUrl);
      return valid ? focusConceptIdFromUrl : null;
    },
    () => null // Server snapshot
  );

  // Apply URL focus concept to state once on mount/when concepts load
  useEffect(() => {
    if (urlFocusConcept && !selectedConceptIds.includes(urlFocusConcept)) {
      setSelectedConceptIds([urlFocusConcept]);
      setStudyMode("custom");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFocusConcept]);

  // Auth guard
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
    // Validation for Focus step
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
      <PageContainer size="xl">
        <div className="py-8">
          {/* Skeleton Header */}
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Skeleton Stepper */}
            <div className="lg:col-span-4">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Skeleton Content */}
            <div className="lg:col-span-8">
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-6 w-64 mb-8" />
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-12 w-20 rounded-full" />
                <Skeleton className="h-12 w-20 rounded-full" />
                <Skeleton className="h-12 w-20 rounded-full" />
                <Skeleton className="h-12 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Error state for document loading failure
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
          <motion.button
            onClick={() => router.push("/upload")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 rounded-xl bg-brand-primary text-surface-dark font-semibold hover:bg-brand-primary/90 transition-colors"
          >
            Upload a Document
          </motion.button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="xl">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="py-8"
      >
        {/* Header */}
        <motion.div variants={slideUpItem} className="text-center mb-12">
          <h1 className="text-h1 font-serif text-text-primary mb-4">
            Configure Your Quiz
          </h1>
          {document && (
            <p className="text-text-secondary">
              Setting up quiz for: <span className="text-brand-primary font-medium">{document.filename}</span>
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left: Stepper */}
          <motion.div variants={slideUpItem} className="lg:col-span-4">
            <div className="sticky top-24">
              <SetupStepper
                steps={STEPS}
                currentStep={currentStep}
                onStepClick={(step) => setCurrentStep(step)}
              />
            </div>
          </motion.div>

          {/* Right: Content */}
          <motion.div variants={slideUpItem} className="lg:col-span-8">
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                {/* Step 1: Focus */}
                {currentStep === 0 && (
                  <motion.div
                    key="step-focus"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={1}
                      question="What should we focus on?"
                    >
                      {/* Option cards: Recommended vs Pick a Topic */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div
                          onClick={() => setStudyMode("recommended")}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden",
                            studyMode === "recommended"
                              ? "border-brand-primary bg-brand-primary/5"
                              : "border-surface-border hover:border-text-secondary"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2 relative z-10">
                            <Sparkles className={cn("w-5 h-5", studyMode === "recommended" ? "text-brand-primary" : "text-text-secondary")} />
                            <h3 className="font-semibold text-text-primary">Recommended</h3>
                          </div>
                          <p className="text-sm text-text-muted relative z-10">Smart mix based on your mastery</p>
                          {studyMode === "recommended" && (
                            <motion.div
                              layoutId="active-ring"
                              className="absolute inset-0 border-2 border-brand-primary rounded-xl pointer-events-none"
                            />
                          )}
                        </div>

                        <div
                          onClick={() => setStudyMode("custom")}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden",
                            studyMode === "custom"
                              ? "border-brand-primary bg-brand-primary/5"
                              : "border-surface-border hover:border-text-secondary"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2 relative z-10">
                            <Target className={cn("w-5 h-5", studyMode === "custom" ? "text-brand-primary" : "text-text-secondary")} />
                            <h3 className="font-semibold text-text-primary">Pick a topic</h3>
                          </div>
                          <p className="text-sm text-text-muted relative z-10">Focus on specific concepts</p>
                        </div>
                      </div>

                      {/* Concept list */}
                      <AnimatePresence>
                        {studyMode === "custom" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex justify-between items-center mb-3 px-1">
                              <p className="text-sm font-medium text-text-secondary">
                                Select up to 3 topics
                              </p>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full border",
                                selectedConceptIds.length === 3
                                  ? "bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20"
                                  : "bg-surface-tertiary text-text-muted border-transparent"
                              )}>
                                {selectedConceptIds.length}/3 selected
                              </span>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {conceptsLoading ? (
                                <div className="space-y-2">
                                  <Skeleton className="h-14 w-full rounded-lg" />
                                  <Skeleton className="h-14 w-full rounded-lg" />
                                  <Skeleton className="h-14 w-full rounded-lg" />
                                </div>
                              ) : conceptsError ? (
                                <ErrorCard 
                                  error={conceptsError}
                                  onRetry={() => refetchConcepts()}
                                  className="my-4"
                                />
                              ) : concepts.length === 0 ? (
                                <div className="text-center py-8 text-text-muted bg-surface-tertiary/30 rounded-lg border border-dashed border-surface-border">
                                  No concepts found for this document.
                                </div>
                              ) : (
                                concepts.map(concept => {
                                  const isSelected = selectedConceptIds.includes(concept.id);
                                  // Rule: Only allow selecting is_core=true unless progress=100 (simplified to just is_core for now as per instructions)
                                  const isCore = concept.is_core;
                                  const isDisabled = !isCore;

                                  return (
                                    <div
                                      key={concept.id}
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
                                        "p-3 rounded-lg border flex items-center justify-between transition-all group",
                                        isDisabled
                                          ? "opacity-60 cursor-not-allowed border-surface-border bg-surface-tertiary/30"
                                          : isSelected
                                            ? "border-brand-primary bg-brand-primary/10 cursor-pointer"
                                            : "border-surface-border hover:border-text-secondary cursor-pointer bg-surface-card hover:translate-x-1"
                                      )}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                          "w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm",
                                          isSelected
                                            ? "bg-brand-primary border-brand-primary"
                                            : "border-text-muted bg-surface-dark group-hover:border-text-secondary"
                                        )}>
                                          {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div>
                                          <p className={cn("font-medium text-sm", isSelected ? "text-text-primary" : "text-text-secondary")}>
                                            {concept.concept_name}
                                          </p>
                                          {isDisabled && (
                                            <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                                              <Lock size={10} />
                                              <span>Unlock by mastering core concepts first</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Mastery Badge */}
                                      <div className="flex flex-col items-end">
                                        {concept.mastery_score !== null ? (
                                          <span className={cn(
                                            "text-xs font-mono font-medium",
                                            (concept.mastery_score ?? 0) > 80 ? "text-semantic-success" : "text-brand-primary"
                                          )}>
                                            {concept.mastery_score}%
                                          </span>
                                        ) : (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 uppercase font-bold tracking-wider">
                                            New
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Manual Testing Notes (Commented out in production but kept fordev reference if needed, per instructions "Add quick manual test notes as comments at bottom of config page") 
                                Actually instructions say "Add quick manual test notes as comments at bottom of config page". I will add them at the bottom of the file.
                            */}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </StepContent>
                  </motion.div>
                )}

                {/* Step 2: Questions */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-questions"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={2}
                      question="How many questions would you like?"
                    >
                      <div className="flex flex-wrap gap-3">
                        {QUESTION_COUNTS.map((count) => (
                          <OptionPill
                            key={count}
                            label={count.toString()}
                            selected={numQuestions === count}
                            onClick={() => setNumQuestions(count)}
                          />
                        ))}
                        <OptionPill
                          label="Custom"
                          selected={!QUESTION_COUNTS.includes(numQuestions)}
                          onClick={() => setNumQuestions(25)}
                        />
                      </div>

                      {/* Custom input if not in standard options */}
                      {!QUESTION_COUNTS.includes(numQuestions) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-6"
                        >
                          <label className="block text-sm text-text-muted mb-2">
                            Custom number (3-50)
                          </label>
                          <input
                            type="number"
                            min={3}
                            max={50}
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(parseInt(e.target.value) || 10)}
                            className="
                              w-full max-w-xs px-4 py-3 rounded-xl
                              bg-surface-card border-2 border-surface-border
                              text-text-primary
                              focus:border-brand-primary focus:outline-none
                              transition-colors
                            "
                          />
                        </motion.div>
                      )}
                    </StepContent>
                  </motion.div>
                )}

                {/* Step 3: Difficulty */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-difficulty"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={3}
                      question="What difficulty level?"
                    >
                      <div className="flex flex-wrap gap-4">
                        {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                          <DifficultyCard
                            key={level}
                            level={level}
                            selected={difficulty === level}
                            onClick={() => setDifficulty(level)}
                          />
                        ))}
                      </div>
                    </StepContent>
                  </motion.div>
                )}

                {/* Step 4: Types */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-types"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={4}
                      question="What types of questions?"
                    >
                      <div className="flex flex-wrap gap-3">
                        {QUESTION_TYPES.map(({ value, label, emoji }) => (
                          <OptionPill
                            key={value}
                            label={`${emoji} ${label}`}
                            selected={questionTypes.includes(value)}
                            onClick={() => toggleQuestionType(value)}
                            multiSelect
                          />
                        ))}
                      </div>

                      {questionTypes.length === 0 && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-semantic-error text-sm mt-4"
                        >
                          Please select at least one question type
                        </motion.p>
                      )}
                    </StepContent>
                  </motion.div>
                )}

                {/* Step 5: Timer */}
                {currentStep === 4 && (
                  <motion.div
                    key="step-timer"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={5}
                      question="Set a time limit?"
                    >
                      <div className="flex flex-wrap gap-3">
                        {TIMER_OPTIONS.map(({ value, label }) => (
                          <OptionPill
                            key={label}
                            label={value ? <span className="flex items-center gap-2"><Clock size={14} /> {label}</span> : label}
                            selected={timerSeconds === value}
                            onClick={() => setTimerSeconds(value)}
                          />
                        ))}
                      </div>

                      {timerSeconds && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 p-4 rounded-xl bg-surface-card border border-surface-border"
                        >
                          <p className="text-sm text-text-muted mb-2">Timer preview</p>
                          <div className="flex items-center gap-3">
                            <Clock size={20} className="text-brand-primary" />
                            <span className="text-2xl font-mono font-bold text-text-primary">
                              {Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:00
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </StepContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-between mt-8 pt-8 border-t border-surface-border"
            >
              <motion.button
                onClick={handleBack}
                disabled={currentStep === 0}
                whileHover={currentStep === 0 ? {} : { x: -4 }}
                className="
                  flex items-center gap-2 px-6 py-3 rounded-xl
                  text-text-secondary font-medium
                  hover:text-text-primary
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                Back
              </motion.button>

              <div className="flex items-center gap-4">
                {sessionError && (
                  <p className="text-semantic-error text-sm">
                    {getErrorMessage(sessionError)}
                  </p>
                )}

                {currentStep < STEPS.length - 1 ? (
                  <motion.button
                    onClick={handleNext}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="
                      flex items-center gap-2 px-8 py-3 rounded-xl
                      bg-brand-primary text-surface-dark
                      font-semibold
                      hover:bg-brand-primary/90 transition-colors
                    "
                  >
                    Continue
                    <ArrowRight size={18} />
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={handleStartQuiz}
                    disabled={creating || questionTypes.length === 0}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="
                      flex items-center gap-2 px-8 py-3 rounded-xl
                      bg-brand-primary text-surface-dark
                      font-semibold
                      hover:bg-brand-primary/90
                      disabled:opacity-70 disabled:cursor-not-allowed
                      transition-colors
                    "
                  >
                    {creating ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Start Quiz
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </PageContainer>
  );
}

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

// Manual Test Notes:
// - Recommended -> session create works (default behavior)
// - Pick 1-3 topics -> session create works with focus_concept_ids
// - Pick 0 topics -> blocked w toast "Please select at least one topic"
// - Pick 4 -> impossible (logic prevents selection with toast "Maximum 3 concepts allowed")
// - Core concept rule -> non-core concepts should be disabled visually
