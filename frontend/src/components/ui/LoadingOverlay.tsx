"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  overlayVariants,
  diamondSpinnerVariants,
  slideUpItem,
} from "@/lib/motions";

const STUDY_TIPS = [
  "Taking breaks improves retention",
  "Quiz yourself to strengthen memory",
  "Explaining concepts helps you learn",
  "Sleep consolidates learning",
  "Space out your study sessions",
  "Connect new ideas to what you know",
  "Stay curious - questions drive learning",
  "Mistakes are learning opportunities",
];

const TIP_ROTATION_INTERVAL = 2500;

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

function LoadingOverlayContent({ message }: { message?: string }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (message) return;

    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % STUDY_TIPS.length);
    }, TIP_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [message]);

  return (
    <motion.div
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface-dark/95 backdrop-blur-sm"
    >
      {/* Diamond Spinner */}
      <motion.div
        variants={diamondSpinnerVariants}
        animate="animate"
        className="w-12 h-12 border-2 border-brand-primary rotate-45 mb-8"
        style={{ borderRadius: "4px" }}
      />

      {/* Message or Rotating Tips */}
      <div className="h-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {message ? (
            <motion.p
              key="custom-message"
              variants={slideUpItem}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="text-text-secondary text-center px-4"
            >
              {message}
            </motion.p>
          ) : (
            <motion.p
              key={tipIndex}
              variants={slideUpItem}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="text-text-secondary text-center px-4"
            >
              {STUDY_TIPS[tipIndex]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function LoadingOverlay({ isVisible, message }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && <LoadingOverlayContent message={message} />}
    </AnimatePresence>
  );
}
