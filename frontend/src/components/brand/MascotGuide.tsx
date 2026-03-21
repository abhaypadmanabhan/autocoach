"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SentinelMascot } from "./SentinelMascot";
import { cn } from "@/lib/utils";

type GuideMessage = {
  id: string;
  message: string;
  variant: "neutral" | "smiling" | "proud" | "pleading" | "thinking" | "timesUp" | "wrong";
  showFor: number; // scroll percentage range
};

const guideMessages: GuideMessage[] = [
  {
    id: "welcome",
    message: "Hi! I'm Uto — your AI study partner!",
    variant: "smiling",
    showFor: 0,
  },
  {
    id: "problem",
    message: "That's actually true... but I can fix that.",
    variant: "thinking",
    showFor: 12,
  },
  {
    id: "features",
    message: "Here's what I bring to the table.",
    variant: "proud",
    showFor: 28,
  },
  {
    id: "how-step-1",
    message: "Drop your files right here. I'll do the rest.",
    variant: "neutral",
    showFor: 42,
  },
  {
    id: "how-step-2",
    message: "I read everything. Every. Single. Line.",
    variant: "thinking",
    showFor: 54,
  },
  {
    id: "how-step-3",
    message: "Then I quiz you. Relentlessly. It's science.",
    variant: "proud",
    showFor: 64,
  },
  {
    id: "stats",
    message: "These numbers are real. Real students. Real results.",
    variant: "smiling",
    showFor: 74,
  },
  {
    id: "testimonials",
    message: "Don't just take my word for it...",
    variant: "neutral",
    showFor: 84,
  },
  {
    id: "cta",
    message: "Come on... one quiz won't hurt. It might just change everything.",
    variant: "pleading",
    showFor: 93,
  },
];

interface MascotGuideProps {
  className?: string;
  enabled?: boolean;
}

export function MascotGuide({ className, enabled = true }: MascotGuideProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState<GuideMessage>(guideMessages[0]);
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Calculate scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / scrollHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Update message based on scroll position
  useEffect(() => {
    if (!enabled) return;

    // Find the appropriate message for current scroll position
    const message = [...guideMessages]
      .reverse()
      .find((m) => scrollProgress >= m.showFor) || guideMessages[0];

    if (message.id !== currentMessage.id) {
      setCurrentMessage(message);
    }
  }, [scrollProgress, currentMessage.id, enabled]);

  // Show mascot after a delay
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [enabled]);

  // Handle user interaction
  const handleInteraction = useCallback(() => {
    setHasInteracted(true);
    // Hide after interaction, then show again
    setTimeout(() => setHasInteracted(false), 5000);
  }, []);

  if (!enabled || !isVisible) return null;

  return (
    <AnimatePresence>
      {!hasInteracted && (
        <motion.div
          className={cn(
            "fixed z-40 bottom-4 right-4 lg:bottom-6 lg:right-6 flex items-end gap-3 pointer-events-auto",
            className
          )}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleInteraction}
        >
          {/* Message Bubble */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMessage.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
              className="relative bg-[var(--surface-card)] border border-[var(--brand-primary)]/30 rounded-2xl px-5 py-4 shadow-xl shadow-[var(--pop-coral)]/10 max-w-[260px] lg:max-w-[300px] mb-4"
            >
              <p className="text-base text-[var(--text-primary)] font-medium leading-relaxed">
                {currentMessage.message}
              </p>
              {/* Triangle pointer - always points right toward mascot */}
              <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-l-8 border-l-[var(--surface-card)] border-y-8 border-y-transparent" />
            </motion.div>
          </AnimatePresence>

          {/* Mascot - hero-sized */}
          <motion.div
            className="relative w-36 h-36 lg:w-48 lg:h-48 shrink-0 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-[var(--brand-primary)] opacity-20 blur-2xl rounded-full" />
            <SentinelMascot variant={currentMessage.variant} className="w-full h-full" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hero-specific mascot with larger presence and dynamic emotions
export function HeroMascot({ className }: { className?: string }) {
  const emotions: Array<"neutral" | "thinking" | "smiling"> = [
    "smiling",
    "thinking",
    "neutral",
  ];

  const [currentEmotion, setCurrentEmotion] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Auto-cycle emotions every 5 seconds
  useEffect(() => {
    if (isHovering) return;

    const interval = setInterval(() => {
      setCurrentEmotion((prev) => (prev + 1) % emotions.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovering, emotions.length]);

  return (
    <motion.div
      className={cn("relative", className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Glow rings - CSS animated */}
      <div className="absolute inset-0 bg-[var(--brand-primary)] blur-3xl rounded-full animate-glow-pulse-primary" />
      <div className="absolute inset-0 bg-[var(--brand-secondary)] blur-2xl rounded-full animate-glow-pulse-secondary" />

      {/* Main mascot container */}
      <div className="relative w-36 h-36 lg:w-48 lg:h-48 xl:w-56 xl:h-56">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentEmotion}
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.9, rotate: 5 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full"
          >
            <SentinelMascot variant={emotions[currentEmotion]} className="w-full h-full" />
          </motion.div>
        </AnimatePresence>

        {/* Hover hint */}
        {isHovering && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[var(--surface-card)] px-3 py-1 rounded-full text-xs text-[var(--text-secondary)] whitespace-nowrap border border-[var(--surface-border)]"
          >
            I&apos;m {emotions[currentEmotion]}!
          </motion.div>
        )}
      </div>

      {/* Floating particles - reduced from 5 to 2 */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-[var(--brand-primary)]"
          style={{
            top: `${20 + i * 40}%`,
            left: i % 2 === 0 ? "-15%" : "115%",
          }}
          animate={{
            y: [-15, 15, -15],
            opacity: [0.2, 0.8, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

// Feature highlight mascot
export function FeatureMascot({ 
  variant = "thinking", 
  className 
}: { 
  variant?: "neutral" | "thinking" | "smiling" | "wrong";
  className?: string;
}) {
  return (
    <motion.div
      className={cn("relative w-20 h-20", className)}
      whileHover={{ scale: 1.1, rotate: 5 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="absolute inset-0 bg-[var(--brand-secondary)] opacity-20 blur-2xl rounded-full" />
      <SentinelMascot variant={variant} className="w-full h-full" />
    </motion.div>
  );
}
