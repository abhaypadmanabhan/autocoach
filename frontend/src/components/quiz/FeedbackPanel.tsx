"use client";

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ArrowRight, Trophy, Sparkles, Frown, Meh, Smile, PartyPopper } from "lucide-react";
import { feedbackPanelVariants, feedbackStagger, feedbackItem } from "@/lib/motions";

const MIN_FEEDBACK_DISPLAY_MS = 1200;

// Subscribe function for useSyncExternalStore that triggers after mount
function createTimeoutStore(delayMs: number) {
  return {
    subscribe(callback: () => void) {
      const timeoutId = setTimeout(callback, delayMs);
      return () => clearTimeout(timeoutId);
    },
    getSnapshot() {
      return false;
    },
  };
}

interface FeedbackPanelProps {
  isCorrect: boolean;
  explanation?: string;
  correctAnswer?: string;
  userAnswer?: string;
  onNext: () => void;
  isLastQuestion?: boolean;
  className?: string;
}

export function FeedbackPanel({
  isCorrect,
  explanation,
  correctAnswer,
  userAnswer,
  onNext,
  isLastQuestion = false,
  className = "",
}: FeedbackPanelProps) {
  // Use useSyncExternalStore to handle the timer without setState in effect
  // This returns true after MIN_FEEDBACK_DISPLAY_MS has elapsed
  const hasEnoughTimeElapsed = useSyncExternalStore(
    createTimeoutStore(MIN_FEEDBACK_DISPLAY_MS).subscribe,
    () => true, // Client snapshot (after hydration, time has passed)
    () => false // Server snapshot (never enough time on server)
  );

  // For non-last questions, always allow proceeding
  // For last question, wait until minimum display time has elapsed
  const canProceed = !isLastQuestion || hasEnoughTimeElapsed;
  return (
    <AnimatePresence>
      <motion.div
        variants={feedbackPanelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-surface-card border-t border-surface-border
          backdrop-blur-lg
          ${className}
        `}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div
            variants={feedbackStagger}
            initial="hidden"
            animate="visible"
            className="flex flex-col md:flex-row md:items-center gap-6"
          >
            {/* Icon and status */}
            <motion.div variants={feedbackItem} className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center
                  ${isCorrect
                    ? "bg-[var(--semantic-success)] bg-opacity-20 text-[var(--semantic-success)]"
                    : "bg-[var(--semantic-error)] bg-opacity-20 text-[var(--semantic-error)]"
                  }
                `}
              >
                {isCorrect ? (
                  <CheckCircle size={32} />
                ) : (
                  <XCircle size={32} />
                )}
              </motion.div>
              <div>
                <h3
                  className={`
                    text-xl font-bold
                    ${isCorrect ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}
                  `}
                >
                  {isCorrect ? "Correct!" : "Not quite"}
                </h3>
                <p className="text-[var(--text-muted)] text-sm">
                  {isCorrect
                    ? "Great job! You got it right."
                    : "Let's review the correct answer."}
                </p>
              </div>
            </motion.div>

            {/* Answer details */}
            <motion.div
              variants={feedbackItem}
              className="flex-1 space-y-2"
            >
              {!isCorrect && correctAnswer && (
                <div className="text-sm">
                  <span className="text-[var(--text-muted)]">Correct answer: </span>
                  <span className="text-[var(--semantic-success)] font-medium">{correctAnswer}</span>
                </div>
              )}
              {!isCorrect && userAnswer && (
                <div className="text-sm">
                  <span className="text-[var(--text-muted)]">Your answer: </span>
                  <span className="text-[var(--semantic-error)] font-medium">{userAnswer}</span>
                </div>
              )}
              {explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-3 rounded-lg bg-[var(--surface-dark)] border border-[var(--surface-border)]/50"
                >
                  <p className="text-sm text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--brand-secondary)]">Note: </span>
                    {explanation}
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* Next button */}
            <motion.div variants={feedbackItem} className="flex-shrink-0">
              {isLastQuestion ? (
                <motion.button
                  onClick={onNext}
                  disabled={!canProceed}
                  initial={{ scale: 1 }}
                  animate={canProceed ? {
                    scale: [1, 1.02, 1],
                    boxShadow: [
                      "0 10px 25px -5px rgba(205, 119, 106, 0.3)",
                      "0 15px 35px -5px rgba(205, 119, 106, 0.5)",
                      "0 10px 25px -5px rgba(205, 119, 106, 0.3)",
                    ],
                  } : {}}
                  transition={canProceed ? {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  } : {}}
                  whileHover={canProceed ? { scale: 1.05 } : {}}
                  whileTap={canProceed ? { scale: 0.98 } : {}}
                  className={`
                    relative flex items-center gap-3 px-8 py-4
                    bg-gradient-to-r from-brand-primary to-brand-secondary
                    text-surface-dark rounded-xl font-bold text-lg
                    transition-all overflow-hidden
                    ${canProceed
                      ? "cursor-pointer hover:shadow-xl"
                      : "opacity-70 cursor-not-allowed"
                    }
                  `}
                >
                  {/* Shimmer effect */}
                  {canProceed && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        repeatDelay: 1,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                  <Trophy size={22} className="relative z-10" />
                  <span className="relative z-10">View Results</span>
                  {canProceed && (
                    <motion.div
                      initial={{ rotate: 0 }}
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Sparkles size={18} className="relative z-10" />
                    </motion.div>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  onClick={onNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="
                    flex items-center gap-2 px-6 py-3
                    bg-[var(--brand-primary)] text-[var(--surface-dark)]
                    rounded-xl font-semibold
                    hover:bg-opacity-90
                    transition-colors
                    shadow-lg shadow-[var(--brand-primary)]/20
                  "
                >
                  Next Question
                  <ArrowRight size={18} />
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface InlineFeedbackProps {
  isCorrect: boolean;
  message?: string;
  className?: string;
}

export function InlineFeedback({
  isCorrect,
  message,
  className = "",
}: InlineFeedbackProps) {
  const defaultMessage = isCorrect ? "Correct!" : "Incorrect";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg
        ${isCorrect
          ? "bg-semantic-success/10 border border-semantic-success/30 text-semantic-success"
          : "bg-semantic-error/10 border border-semantic-error/30 text-semantic-error"
        }
        ${className}
      `}
    >
      {isCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
      <span className="font-medium">{message || defaultMessage}</span>
    </motion.div>
  );
}

interface ScoreFeedbackProps {
  score: number;
  total: number;
  className?: string;
}

export function ScoreFeedback({
  score,
  total,
  className = "",
}: ScoreFeedbackProps) {
  const percentage = Math.round((score / total) * 100);

  const getFeedback = () => {
    if (percentage >= 90) return { icon: PartyPopper, message: "Outstanding!", color: "text-semantic-success" };
    if (percentage >= 70) return { icon: Smile, message: "Great job!", color: "text-semantic-success" };
    if (percentage >= 50) return { icon: Meh, message: "Good effort!", color: "text-semantic-warning" };
    return { icon: Frown, message: "Keep practicing!", color: "text-semantic-error" };
  };

  const { icon: Icon, message, color } = getFeedback();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
      className={`text-center ${className}`}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <Icon size={48} className={`mx-auto ${color}`} />
      </motion.div>
      <h3 className={`text-2xl font-bold ${color}`}>{message}</h3>
      <p className="text-text-muted mt-2">
        You got <span className="text-text-primary font-semibold">{score}</span> out of{" "}
        <span className="text-text-primary font-semibold">{total}</span> correct
      </p>
    </motion.div>
  );
}
