"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "thinking" | "wrong" | "success" | "timeout";

interface SentinelMascotProps {
  variant?: Variant;
  className?: string;
}

// Mouse position hook for sentient eye tracking
function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  return mousePosition;
}

// SVG Path definitions for each variant
const EYE_PATHS = {
  neutral: {
    left: "M12 18c0-3 2.5-5 5-5s5 2 5 5",
    right: "M38 18c0-3 2.5-5 5-5s5 2 5 5",
  },
  thinking: {
    left: "M12 20c0-2 2.5-4 5-4s5 1 5 4",
    right: "M38 16c0-4 2.5-6 5-6s5 2 5 6",
  },
  wrong: {
    left: "M14 16l6 6M20 16l-6 6",
    right: "M40 16l6 6M46 16l-6 6",
  },
  success: {
    left: "M12 22c2-3 5-4 8-2",
    right: "M38 22c2-3 5-4 8-2",
  },
  timeout: {
    left: "M12 20c0-3 2.5-5 5-5s5 2 5 5",
    right: "M38 20c0-3 2.5-5 5-5s5 2 5 5",
  },
};

export function SentinelMascot({ variant = "neutral", className }: SentinelMascotProps) {
  const mousePosition = useMousePosition();
  const [isBlinking, setIsBlinking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Smooth spring animation for eye movement
  const eyeX = useSpring(0, { stiffness: 150, damping: 15 });
  const eyeY = useSpring(0, { stiffness: 150, damping: 15 });

  // Blink logic: random intervals between 3-7 seconds
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 4000; // 3-7 seconds
      const timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, delay);
      return timeoutId;
    };

    const timeoutId = scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Sentient "Look At" feature: track mouse position
  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate offset from center (max 4px)
    const offsetX = ((mousePosition.x - centerX) / window.innerWidth) * 8;
    const offsetY = ((mousePosition.y - centerY) / window.innerHeight) * 8;

    // Clamp to max 4px
    const clampedX = Math.max(-4, Math.min(4, offsetX));
    const clampedY = Math.max(-4, Math.min(4, offsetY));

    eyeX.set(clampedX);
    eyeY.set(clampedY);
  }, [mousePosition, eyeX, eyeY]);

  const currentEyes = EYE_PATHS[variant];

  return (
    <motion.div
      ref={containerRef}
      className={cn("relative w-24 h-24", className)}
      animate={{
        y: [0, -5, 0],
      }}
      transition={{
        duration: 4,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      }}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Head shape */}
        <motion.path
          d="M32 4C16.5 4 4 16.5 4 32s12.5 28 28 28 28-12.5 28-28S47.5 4 32 4z"
          className="fill-[var(--brand-secondary)]"
          style={{ opacity: 0.85 }}
          initial={false}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />

        {/* Eyes group with tracking */}
        <motion.g
          style={{ x: eyeX, y: eyeY }}
          animate={{
            scaleY: isBlinking ? 0.1 : 1,
          }}
          transition={{
            scaleY: { duration: 0.075, ease: "easeInOut" },
          }}
        >
          <AnimatePresence mode="wait">
            <motion.g
              key={variant}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {/* Left eye */}
              <motion.path
                d={currentEyes.left}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="text-[var(--brand-primary)]"
                fill="none"
              />
              {/* Right eye */}
              <motion.path
                d={currentEyes.right}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="text-[var(--brand-primary)]"
                fill="none"
              />
            </motion.g>
          </AnimatePresence>
        </motion.g>

        {/* Mouth - varies by variant */}
        <AnimatePresence mode="wait">
          <motion.path
            key={`mouth-${variant}`}
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            exit={{ opacity: 0, pathLength: 0 }}
            transition={{ duration: 0.2 }}
            d={
              variant === "success"
                ? "M20 42c3 4 10 6 14 6s11-2 14-6"
                : variant === "wrong"
                ? "M24 48c4-2 8-3 12-3s8 1 12 3"
                : variant === "thinking"
                ? "M28 46c2 0 4 1 6 1s4-1 6-1"
                : "M26 44c2 2 6 3 10 3s8-1 10-3"
            }
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-[var(--brand-primary)]"
            fill="none"
          />
        </AnimatePresence>

        {/* Whistle for timeout variant */}
        <AnimatePresence>
          {variant === "timeout" && (
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: [-1, 1, -1, 1, -1],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                x: {
                  duration: 0.3,
                  repeat: Infinity,
                  ease: "linear",
                },
              }}
            >
              {/* Whistle body */}
              <circle cx="48" cy="48" r="6" className="fill-[var(--brand-primary)]" />
              {/* Whistle hole */}
              <circle cx="46" cy="46" r="2" className="fill-[var(--surface-dark)]" />
              {/* Whistle ring */}
              <path
                d="M52 50c2 0 4-1 4-3s-2-3-4-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="text-[var(--brand-primary)]"
                fill="none"
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* Thinking indicator dots */}
        <AnimatePresence>
          {variant === "thinking" && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={50 + i * 4}
                  cy="12"
                  r="1.5"
                  className="fill-[var(--brand-primary)]"
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    y: [0, -2, 0],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </motion.div>
  );
}
