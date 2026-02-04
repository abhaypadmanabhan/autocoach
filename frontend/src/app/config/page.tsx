"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Check, Clock, Sparkles } from "lucide-react";
import { useCreateSession } from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { SetupStepper, StepContent } from "@/components/quiz/SetupStepper";
import { OptionPill, DifficultyCard, OptionPillGrid } from "@/components/ui/OptionPill";
import { DiamondButton } from "@/components/ui/DiamondButton";
import { staggerContainer, slideUpItem, stepExitVariants, stepEnterVariants } from "@/lib/motions";
import type { Difficulty, QuestionType } from "@/lib/types";

const STEPS = [
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
  const { document, loading: docLoading } = useDocument(documentId);
  const { createSession, creating, error: sessionError } = useCreateSession();

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["mcq", "true_false"]);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

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
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
      </div>
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
                {/* Step 1: Questions */}
                {currentStep === 0 && (
                  <motion.div
                    key="step-questions"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={1}
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

                {/* Step 2: Difficulty */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-difficulty"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={2}
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

                {/* Step 3: Types */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-types"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={3}
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

                {/* Step 4: Timer */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-timer"
                    variants={stepEnterVariants}
                    initial="initial"
                    animate="enter"
                    exit="exit"
                  >
                    <StepContent
                      stepNumber={4}
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
