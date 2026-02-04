"use client";

import { motion } from "framer-motion";
import { DiamondMarker } from "@/components/ui/DiamondButton";
import { staggerContainer, slideUpItem } from "@/lib/motions";

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface SetupStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function SetupStepper({
  steps,
  currentStep,
  onStepClick,
  className = "",
}: SetupStepperProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={`flex flex-col gap-6 ${className}`}
    >
      {/* Circular Progress Indicator */}
      <motion.div
        variants={slideUpItem}
        className="relative w-32 h-32 mx-auto mb-8"
      >
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-surface-border/30"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          {/* Progress arc */}
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: (currentStep + 1) / steps.length }}
            transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
            className="text-brand-primary"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="100"
          />
        </svg>

        {/* Step number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={currentStep}
            initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-5xl font-light text-text-primary tracking-tight"
          >
            .{String(currentStep + 1).padStart(2, "0")}
          </motion.span>
          <span className="text-xs text-text-muted uppercase tracking-wider mt-1">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
      </motion.div>

      {/* Vertical Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-surface-border/30" />

        {/* Step items */}
        <div className="flex flex-col gap-4">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <motion.div
                key={step.id}
                variants={slideUpItem}
                className="relative flex items-start gap-4"
              >
                {/* Diamond marker */}
                <div className="relative z-10">
                  <DiamondMarker
                    active={isActive}
                    completed={isCompleted}
                    onClick={() => onStepClick?.(index)}
                  />
                </div>

                {/* Step label */}
                <div className="flex-1 pt-0.5">
                  <motion.button
                    onClick={() => onStepClick?.(index)}
                    className={`
                      text-left transition-colors duration-300
                      ${isActive
                        ? "text-brand-primary"
                        : isCompleted
                          ? "text-text-primary"
                          : "text-text-muted"
                      }
                    `}
                    whileHover={{ x: isCompleted || isActive ? 4 : 0 }}
                  >
                    <span className={`
                      font-medium block
                      ${isActive ? "text-brand-primary" : ""}
                    `}>
                      {step.label}
                    </span>
                    {step.description && (
                      <span className={`
                        text-xs block mt-0.5
                        ${isActive ? "text-text-secondary" : "text-text-muted"}
                      `}>
                        {step.description}
                      </span>
                    )}
                  </motion.button>
                </div>

                {/* Connecting line animation */}
                {isActive && index < steps.length - 1 && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="absolute left-[7px] top-6 w-0.5 bg-brand-primary/50"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

interface StepContentProps {
  children: React.ReactNode;
  stepNumber: number;
  question: string;
  className?: string;
}

export function StepContent({
  children,
  stepNumber,
  question,
  className = "",
}: StepContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
      className={`space-y-6 ${className}`}
    >
      {/* Decorative step number */}
      <div className="flex items-baseline gap-3">
        <motion.span
          initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-6xl font-serif font-light text-brand-primary/20"
        >
          .{String(stepNumber).padStart(2, "0")}
        </motion.span>
      </div>

      {/* Question */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-h2 font-serif text-text-primary"
      >
        {question}
      </motion.h2>

      {/* Options */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
