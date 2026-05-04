"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { CheckCircle, XCircle, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { accordionVariants, listItemVariants } from "@/lib/motions";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/lib/types";

// ============================================
// Shared helpers
// ============================================

function getQuestionTypeLabel(type: QuestionType) {
  switch (type) {
    case "text_mcq":
      return "Multiple Choice";
    case "text_tf":
      return "True/False";
    case "text_free":
      return "Free Response";
    case "rendered":
      return "Interactive";
    default:
      return type;
  }
}

// ============================================
// ReviewAccordion — shadcn-based replacement
// ============================================

interface ReviewItem {
  question_id: string;
  question_number: number;
  question_text: string;
  question_type: QuestionType;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string;
}

interface ReviewAccordionProps {
  items: ReviewItem[];
  className?: string;
}

export function ReviewAccordion({ items, className = "" }: ReviewAccordionProps) {
  return (
    <Accordion type="multiple" className={className}>
      {items.map((item, index) => (
        <motion.div
          key={item.question_id}
          variants={listItemVariants}
          custom={index}
          initial="hidden"
          animate="visible"
        >
          <AccordionItem
            value={item.question_id}
            className="border-b border-[var(--surface-border)]/50 last:border-0"
          >
            <AccordionTrigger className="hover:no-underline px-4 py-4 hover:bg-[var(--surface-card)]/50 transition-colors">
              <div className="flex items-start gap-4 text-left w-full mr-4">
                {/* Status indicator */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    item.is_correct
                      ? "bg-[var(--semantic-success)]/10 text-[var(--semantic-success)]"
                      : "bg-[var(--semantic-error)]/10 text-[var(--semantic-error)]"
                  )}
                >
                  {item.is_correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>

                {/* Question content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
                      Q{item.question_number}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--surface-border)]/50">
                      {getQuestionTypeLabel(item.question_type)}
                    </span>
                  </div>
                  <p className="text-[var(--text-primary)] font-medium line-clamp-2">
                    {item.question_text}
                  </p>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pl-[72px]">
              <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--surface-border)]/50">
                {/* User's answer */}
                <div>
                  <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Your Answer
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      item.is_correct
                        ? "text-[var(--semantic-success)]"
                        : "text-[var(--semantic-error)]"
                    )}
                  >
                    {item.user_answer || "Not answered"}
                  </span>
                </div>

                {/* Correct answer (if wrong) */}
                {!item.is_correct && (
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Correct Answer
                    </span>
                    <span className="font-medium text-[var(--semantic-success)]">
                      {item.correct_answer}
                    </span>
                  </div>
                )}

                {/* Explanation */}
                {item.explanation && (
                  <div className="pt-2 border-t border-[var(--surface-border)]/30">
                    <span className="text-xs text-[var(--brand-secondary)] uppercase tracking-wider block mb-1">
                      Explanation
                    </span>
                    <p className="text-sm text-[var(--text-secondary)]">{item.explanation}</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </motion.div>
      ))}
    </Accordion>
  );
}

// ============================================
// Legacy exports — kept for backward compat
// ============================================

interface ReviewRowProps {
  questionNumber: number;
  questionText: string;
  questionType: QuestionType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  className?: string;
}

export function ReviewRow({
  questionNumber,
  questionText,
  questionType,
  userAnswer,
  correctAnswer,
  isCorrect,
  explanation,
  className = "",
}: ReviewRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case "text_mcq":
        return "🔘";
      case "text_tf":
        return "✓";
      case "text_free":
        return "✏️";
      case "rendered":
        return "🎛️";
      default:
        return "❓";
    }
  };

  return (
    <motion.div
      variants={listItemVariants}
      custom={questionNumber - 1}
      initial="hidden"
      animate="visible"
      className={`
        border-b border-surface-border/50 last:border-0
        ${className}
      `}
    >
      {/* Collapsed row */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-surface-card/50 transition-colors text-left"
      >
        {/* Status indicator */}
        <div
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${isCorrect
              ? "bg-semantic-success/10 text-semantic-success"
              : "bg-semantic-error/10 text-semantic-error"
            }
          `}
        >
          {isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
        </div>

        {/* Question content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-text-muted uppercase">
              Q{questionNumber}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-lg bg-surface-card text-text-secondary border border-surface-border/50">
              {getQuestionTypeIcon(questionType)} {getQuestionTypeLabel(questionType)}
            </span>
          </div>
          <p className="text-text-primary font-medium line-clamp-2">
            {questionText}
          </p>
        </div>

        {/* Expand icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-text-muted"
        >
          <ChevronDown size={20} />
        </motion.div>
      </motion.button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={accordionVariants}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-[72px]">
              <div className="space-y-3 p-4 rounded-xl bg-surface-card border border-surface-border/50">
                {/* User's answer */}
                <div>
                  <span className="text-xs text-text-muted uppercase tracking-wider block mb-1">
                    Your Answer
                  </span>
                  <span
                    className={`font-medium ${
                      isCorrect ? "text-semantic-success" : "text-semantic-error"
                    }`}
                  >
                    {userAnswer || "Not answered"}
                  </span>
                </div>

                {/* Correct answer (if wrong) */}
                {!isCorrect && (
                  <div>
                    <span className="text-xs text-text-muted uppercase tracking-wider block mb-1">
                      Correct Answer
                    </span>
                    <span className="font-medium text-semantic-success">
                      {correctAnswer}
                    </span>
                  </div>
                )}

                {/* Explanation */}
                {explanation && (
                  <div className="pt-2 border-t border-surface-border/30">
                    <span className="text-xs text-brand-secondary uppercase tracking-wider block mb-1">
                      Explanation
                    </span>
                    <p className="text-sm text-text-secondary">{explanation}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ReviewListProps {
  items: Array<{
    question_id: string;
    question_number: number;
    question_text: string;
    question_type: QuestionType;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation?: string;
  }>;
  className?: string;
}

export function ReviewList({ items, className = "" }: ReviewListProps) {
  return (
    <div className={`bg-surface-card rounded-2xl border border-surface-border overflow-hidden ${className}`}>
      {items.map((item, index) => (
        <ReviewRow
          key={item.question_id}
          questionNumber={item.question_number}
          questionText={item.question_text}
          questionType={item.question_type}
          userAnswer={item.user_answer}
          correctAnswer={item.correct_answer}
          isCorrect={item.is_correct}
          explanation={item.explanation}
        />
      ))}
    </div>
  );
}

interface ReviewSummaryProps {
  total: number;
  correct: number;
  incorrect: number;
  skipped?: number;
  className?: string;
}

export function ReviewSummary({
  total,
  correct,
  incorrect,
  skipped = 0,
  className = "",
}: ReviewSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}
    >
      <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-center">
        <p className="text-2xl font-bold text-text-primary">{total}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider">Total</p>
      </div>

      <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-center">
        <CheckCircle size={24} className="mx-auto mb-2 text-semantic-success" />
        <p className="text-2xl font-bold text-semantic-success">{correct}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider">Correct</p>
      </div>

      <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-center">
        <XCircle size={24} className="mx-auto mb-2 text-semantic-error" />
        <p className="text-2xl font-bold text-semantic-error">{incorrect}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider">Wrong</p>
      </div>

      {skipped > 0 && (
        <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-center">
          <p className="text-2xl font-bold text-semantic-warning">{skipped}</p>
          <p className="text-xs text-text-muted uppercase tracking-wider">Skipped</p>
        </div>
      )}
    </motion.div>
  );
}
