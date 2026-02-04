"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";
import { staggerContainer, slideUpItem, optionVariants } from "@/lib/motions";
import { VoiceRecorder } from "./VoiceRecorder";
import type { QuestionType } from "@/lib/types";

interface QuestionCardProps {
  number: number;
  question: string;
  type: QuestionType;
  options?: string[] | null;
  onAnswer: (answer: string) => void;
  selectedAnswer?: string;
  showFeedback?: boolean;
  correctAnswer?: string;
  className?: string;
}

export function QuestionCard({
  number,
  question,
  type,
  options,
  onAnswer,
  selectedAnswer,
  showFeedback = false,
  correctAnswer,
  className = "",
}: QuestionCardProps) {
  const getQuestionTypeLabel = (t: QuestionType) => {
    switch (t) {
      case "mcq":
        return "Multiple Choice";
      case "true_false":
        return "True or False";
      case "free_text":
        return "Free Response";
      default:
        return "Unknown Type";
    }
  };

  // Render content based on question type
  const renderQuestionContent = () => {
    switch (type) {
      case "mcq":
        return (
          <MCQOptions
            options={options}
            selectedAnswer={selectedAnswer}
            correctAnswer={correctAnswer}
            showFeedback={showFeedback}
            onAnswer={onAnswer}
            questionNumber={number}
          />
        );

      case "true_false":
        return (
          <TrueFalseOptions
            selectedAnswer={selectedAnswer}
            correctAnswer={correctAnswer}
            showFeedback={showFeedback}
            onAnswer={onAnswer}
          />
        );

      case "free_text":
        return (
          <div className="space-y-4">
            <FreeTextInput
              value={selectedAnswer || ""}
              onChange={onAnswer}
              disabled={showFeedback}
              placeholder="Type your answer here..."
            />
            
            {/* Voice input section */}
            {!showFeedback && (
              <div className="pt-4 border-t border-surface-border/50">
                <VoiceRecorder
                  onTranscription={(text) => {
                    // Append transcription to existing text with a space
                    const currentText = selectedAnswer || "";
                    const separator = currentText && !currentText.endsWith(" ") ? " " : "";
                    onAnswer(currentText + separator + text);
                  }}
                  disabled={showFeedback}
                />
              </div>
            )}
          </div>
        );

      default:
        // Fallback for missing/unknown question_type
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error"
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Question Error</h3>
                <p className="text-sm opacity-90">
                  Unable to display this question due to an invalid or missing question type.
                  Please try refreshing the page or contact support if the problem persists.
                </p>
              </div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
      className={`relative ${className}`}
    >
      {/* Decorative number */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <span className="text-7xl font-serif font-light text-brand-primary/20">
          .{String(number).padStart(2, "0")}
        </span>
      </motion.div>

      {/* Question type badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-4"
      >
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-card border border-surface-border text-brand-secondary">
          {getQuestionTypeLabel(type)}
        </span>
      </motion.div>

      {/* Question text */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-h2 font-serif text-text-primary mb-8 leading-tight"
      >
        {question}
      </motion.h2>

      {/* Question content based on type */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${number}-${type}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderQuestionContent()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// MCQ Options Component
interface MCQOptionsProps {
  options?: string[] | null;
  selectedAnswer?: string;
  correctAnswer?: string;
  showFeedback: boolean;
  onAnswer: (answer: string) => void;
  questionNumber: number;
}

function MCQOptions({
  options,
  selectedAnswer,
  correctAnswer,
  showFeedback,
  onAnswer,
  questionNumber,
}: MCQOptionsProps) {
  // If no options provided, show error
  if (!options || options.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error"
      >
        <p className="text-sm">No options available for this question.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={`mcq-${questionNumber}`}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {options.map((option, index) => {
        const isSelected = selectedAnswer === option;
        const isCorrectOption = showFeedback && correctAnswer === option;
        const isWrongSelection = showFeedback && isSelected && correctAnswer !== option;

        // Determine visual state (priority: correct > wrong > selected > idle)
        const visualState = isCorrectOption
          ? "correct"
          : isWrongSelection
            ? "wrong"
            : isSelected
              ? "selected"
              : "idle";

        // Get border/bg styles based on state
        const getContainerStyles = () => {
          if (isCorrectOption) {
            return "border-semantic-success bg-semantic-success/10";
          }
          if (isWrongSelection) {
            return "border-semantic-error bg-semantic-error/10";
          }
          if (isSelected) {
            return "border-brand-primary bg-brand-primary/10";
          }
          return "border-surface-border bg-surface-card hover:border-brand-primary/50";
        };

        // Get indicator styles based on state
        const getIndicatorStyles = () => {
          if (isCorrectOption) {
            return "bg-semantic-success text-white";
          }
          if (isWrongSelection) {
            return "bg-semantic-error text-white";
          }
          if (isSelected) {
            return "bg-brand-primary text-surface-dark";
          }
          return "bg-surface-dark text-text-secondary";
        };

        // Get text styles based on state
        const getTextStyles = () => {
          if (isCorrectOption) {
            return "text-semantic-success font-semibold";
          }
          if (isWrongSelection) {
            return "text-semantic-error";
          }
          return "text-text-primary";
        };

        return (
          <motion.button
            key={index}
            variants={slideUpItem}
            onClick={() => !showFeedback && onAnswer(option)}
            disabled={showFeedback}
            initial="idle"
            whileHover={showFeedback ? undefined : "hover"}
            whileTap={showFeedback ? undefined : "tap"}
            animate={visualState}
            className={`
              w-full text-left p-4 rounded-xl border-2
              flex items-center gap-4
              transition-all duration-200
              disabled:cursor-default
              ${getContainerStyles()}
            `}
          >
            {/* Option letter (A, B, C, D...) */}
            <div
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                font-bold text-sm flex-shrink-0
                transition-all duration-200
                ${getIndicatorStyles()}
              `}
            >
              {String.fromCharCode(65 + index)}
            </div>

            {/* Option text */}
            <span className={`text-base font-medium flex-1 ${getTextStyles()}`}>
              {option}
            </span>

            {/* Selection indicator - only show when not in feedback mode */}
            {!showFeedback && isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center"
              >
                <Check size={14} className="text-surface-dark" />
              </motion.div>
            )}

            {/* Feedback indicators */}
            {showFeedback && isCorrectOption && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-semantic-success flex items-center justify-center"
              >
                <Check size={14} className="text-white" />
              </motion.div>
            )}
            {showFeedback && isWrongSelection && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-semantic-error flex items-center justify-center"
              >
                <span className="text-white text-xs font-bold">✕</span>
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// True/False Options Component
interface TrueFalseOptionsProps {
  selectedAnswer?: string;
  correctAnswer?: string;
  showFeedback: boolean;
  onAnswer: (answer: string) => void;
}

function TrueFalseOptions({
  selectedAnswer,
  correctAnswer,
  showFeedback,
  onAnswer,
}: TrueFalseOptionsProps) {
  // Hardcoded True/False options - always shown regardless of backend options
  const booleanOptions = [
    { value: "True", label: "True" },
    { value: "False", label: "False" },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {booleanOptions.map((option) => {
        const isSelected = selectedAnswer === option.value;
        const isCorrectOption = showFeedback && correctAnswer === option.value;
        const isWrongSelection = showFeedback && isSelected && correctAnswer !== option.value;

        // Determine visual state (priority: correct > wrong > selected > idle)
        const visualState = isCorrectOption
          ? "correct"
          : isWrongSelection
            ? "wrong"
            : isSelected
              ? "selected"
              : "idle";

        // Get border/bg styles based on state
        const getContainerStyles = () => {
          if (isCorrectOption) {
            return "border-semantic-success bg-semantic-success/10";
          }
          if (isWrongSelection) {
            return "border-semantic-error bg-semantic-error/10";
          }
          if (isSelected) {
            return "border-brand-primary bg-brand-primary/10";
          }
          return "border-surface-border bg-surface-card hover:border-brand-primary/50";
        };

        // Get indicator styles based on state
        const getIndicatorStyles = () => {
          if (isCorrectOption) {
            return "bg-semantic-success text-white";
          }
          if (isWrongSelection) {
            return "bg-semantic-error text-white";
          }
          if (isSelected) {
            return "bg-brand-primary text-surface-dark";
          }
          return "bg-surface-dark text-text-secondary";
        };

        // Get indicator content based on state
        const getIndicatorContent = () => {
          if (isCorrectOption || isSelected) {
            return <Check size={18} />;
          }
          return <span className="w-2 h-2 rounded-full bg-current" />;
        };

        // Get text styles based on state
        const getTextStyles = () => {
          if (isCorrectOption) {
            return "text-semantic-success font-semibold";
          }
          if (isWrongSelection) {
            return "text-semantic-error";
          }
          return "text-text-primary";
        };

        return (
          <motion.button
            key={option.value}
            variants={slideUpItem}
            onClick={() => !showFeedback && onAnswer(option.value)}
            disabled={showFeedback}
            initial="idle"
            whileHover={showFeedback ? undefined : "hover"}
            whileTap={showFeedback ? undefined : "tap"}
            animate={visualState}
            className={`
              w-full text-left p-4 rounded-xl border-2
              flex items-center gap-4
              transition-all duration-200
              disabled:cursor-default
              ${getContainerStyles()}
            `}
          >
            {/* Option indicator */}
            <div
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                font-bold text-sm flex-shrink-0
                transition-all duration-200
                ${getIndicatorStyles()}
              `}
            >
              {getIndicatorContent()}
            </div>

            {/* Option text */}
            <span className={`text-base font-medium flex-1 ${getTextStyles()}`}>
              {option.label}
            </span>

            {/* Selection indicator - only show when not in feedback mode */}
            {!showFeedback && isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center"
              >
                <Check size={14} className="text-surface-dark" />
              </motion.div>
            )}

            {/* Feedback indicators */}
            {showFeedback && isCorrectOption && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-semantic-success flex items-center justify-center"
              >
                <Check size={14} className="text-white" />
              </motion.div>
            )}
            {showFeedback && isWrongSelection && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-semantic-error flex items-center justify-center"
              >
                <span className="text-white text-xs font-bold">✕</span>
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// Free Text Input Component
interface FreeTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

export function FreeTextInput({
  value,
  onChange,
  placeholder = "Type your answer here...",
  maxLength = 500,
  disabled = false,
  className = "",
}: FreeTextInputProps) {
  // Ensure value is always a string and trimmed
  const sanitizedValue = typeof value === "string" ? value : "";
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Pass the value (parent component should trim when submitting)
    onChange(newValue);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={`space-y-3 ${className}`}
    >
      <motion.div variants={slideUpItem} className="space-y-2">
        <textarea
          value={sanitizedValue}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          rows={4}
          className={`
            w-full p-4 rounded-xl border-2
            bg-surface-card border-surface-border
            text-text-primary placeholder-text-muted
            focus:border-brand-primary focus:outline-none
            resize-none transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">
            Type your answer and click Submit
          </span>
          <span className="text-xs text-text-muted">
            {sanitizedValue.length}/{maxLength}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Option Button Component (kept for backward compatibility)
interface OptionButtonProps {
  label: string;
  selected?: boolean;
  correct?: boolean;
  revealed?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function OptionButton({
  label,
  selected = false,
  correct = false,
  revealed = false,
  onClick,
  disabled = false,
  className = "",
}: OptionButtonProps) {
  const getVariant = () => {
    if (revealed) {
      if (correct) return "correct";
      if (selected && !correct) return "wrong";
    }
    if (selected) return "selected";
    return "idle";
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial="idle"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      variants={optionVariants}
      animate={getVariant()}
      className={`
        w-full text-left p-4 rounded-xl border-2
        transition-all duration-200
        ${className}
      `}
    >
      <span className="font-medium">{label}</span>
    </motion.button>
  );
}
