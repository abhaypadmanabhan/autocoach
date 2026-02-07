"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SentinelMascot } from "./SentinelMascot";
import { cn } from "@/lib/utils";

type GuideMessage = {
  id: string;
  message: string;
  variant: "neutral" | "thinking" | "success" | "wrong" | "timeout";
  position: "top-right" | "bottom-right" | "bottom-left" | "center";
  showFor: number; // scroll percentage range
};

const guideMessages: GuideMessage[] = [
  {
    id: "welcome",
    message: "Hey there! Ready to learn smarter?",
    variant: "success",
    position: "center",
    showFor: 0, // Hero section
  },
  {
    id: "features",
    message: "Check out what I can do for you!",
    variant: "thinking",
    position: "bottom-right",
    showFor: 25, // Features section
  },
  {
    id: "how-it-works",
    message: "It's super simple. Three steps!",
    variant: "neutral",
    position: "bottom-left",
    showFor: 50, // How it works
  },
  {
    id: "demo",
    message: "Watch me in action...",
    variant: "thinking",
    position: "bottom-right",
    showFor: 70, // Demo section
  },
  {
    id: "cta",
    message: "Let's start your journey!",
    variant: "success",
    position: "center",
    showFor: 90, // CTA/Footer
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
    }, 1500);

    return () => clearTimeout(timer);
  }, [enabled]);

  // Handle user interaction
  const handleInteraction = useCallback(() => {
    setHasInteracted(true);
    // Hide after interaction, then show again
    setTimeout(() => setHasInteracted(false), 5000);
  }, []);

  if (!enabled || !isVisible) return null;

  const positionClasses = {
    "top-right": "top-24 right-6 lg:right-12",
    "bottom-right": "bottom-24 right-6 lg:right-12",
    "bottom-left": "bottom-24 left-6 lg:left-12",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <AnimatePresence>
      {!hasInteracted && (
        <motion.div
          className={cn(
            "fixed z-40 flex items-center gap-3 pointer-events-auto",
            positionClasses[currentMessage.position],
            className
          )}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleInteraction}
        >
          {/* Message Bubble */}
          <motion.div
            key={currentMessage.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={cn(
              "relative bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl px-4 py-3 shadow-xl",
              "max-w-[200px] lg:max-w-[240px]",
              currentMessage.position === "bottom-left" ? "order-2" : "order-1"
            )}
          >
            <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
              {currentMessage.message}
            </p>
            {/* Triangle pointer */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-0 h-0",
                currentMessage.position === "bottom-left"
                  ? "-right-2 border-l-8 border-l-[var(--surface-card)] border-y-8 border-y-transparent"
                  : "-left-2 border-r-8 border-r-[var(--surface-card)] border-y-8 border-y-transparent"
              )}
            />
          </motion.div>

          {/* Mascot */}
          <motion.div
            className={cn(
              "relative w-16 h-16 lg:w-20 lg:h-20 shrink-0 cursor-pointer",
              currentMessage.position === "bottom-left" ? "order-1" : "order-2"
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-[var(--brand-primary)] opacity-20 blur-xl rounded-full" />
            <SentinelMascot variant={currentMessage.variant} className="w-full h-full" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hero-specific mascot with larger presence and dynamic emotions
export function HeroMascot({ className }: { className?: string }) {
  // Cycle through emotions
  const emotions: Array<"neutral" | "thinking" | "success" | "wrong"> = [
    "success",
    "thinking", 
    "neutral",
    "success",
    "wrong",
    "thinking",
  ];
  
  const [currentEmotion, setCurrentEmotion] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Auto-cycle emotions every 3 seconds
  useEffect(() => {
    if (isHovering) return; // Pause on hover
    
    const interval = setInterval(() => {
      setCurrentEmotion((prev) => (prev + 1) % emotions.length);
    }, 3000);

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
      {/* Glow rings */}
      <motion.div
        className="absolute inset-0 bg-[var(--brand-primary)] opacity-10 blur-3xl rounded-full scale-150"
        animate={{ 
          scale: [1.5, 1.7, 1.5], 
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Secondary glow */}
      <motion.div
        className="absolute inset-0 bg-[var(--brand-secondary)] opacity-10 blur-2xl rounded-full"
        animate={{ 
          scale: [1.3, 1.5, 1.3], 
          opacity: [0.08, 0.15, 0.08],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      
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

      {/* Floating particles */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-[var(--brand-primary)]"
          style={{
            top: `${15 + i * 18}%`,
            left: i % 2 === 0 ? "-15%" : "115%",
          }}
          animate={{
            y: [-15, 15, -15],
            opacity: [0.2, 0.8, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 2 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Emotion indicator dots */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
        {emotions.map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--surface-border)]"
            animate={{
              backgroundColor: i === currentEmotion 
                ? "var(--brand-primary)" 
                : "var(--surface-border)",
              scale: i === currentEmotion ? 1.3 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Feature highlight mascot
export function FeatureMascot({ 
  variant = "thinking", 
  className 
}: { 
  variant?: "neutral" | "thinking" | "success" | "wrong";
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
