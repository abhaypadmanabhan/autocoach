"use client";

import { motion } from "framer-motion";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

interface TimerBarProps {
  duration: number;
  remaining: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  className?: string;
}

export function TimerBar({
  duration,
  remaining,
  warningThreshold = 30,
  criticalThreshold = 10,
  className = "",
}: TimerBarProps) {
  const progress = Math.max(0, Math.min(100, (remaining / duration) * 100));

  const getColor = () => {
    if (remaining <= criticalThreshold) return "#ef4444"; // Red
    if (remaining <= warningThreshold) return "#eab308"; // Yellow
    return "#c18c5d"; // Brand secondary
  };

  const getStatus = () => {
    if (remaining <= criticalThreshold) return "critical";
    if (remaining <= warningThreshold) return "warning";
    return "normal";
  };

  const status = getStatus();
  const color = getColor();

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Timer size={16} className={status === "critical" ? "text-semantic-error" : "text-brand-secondary"} />
          <span className={`text-sm font-medium ${status === "critical" ? "text-semantic-error" : "text-text-secondary"}`}>
            Time Remaining
          </span>
        </div>
        <motion.span
          animate={status === "critical" ? {
            scale: [1, 1.05, 1],
            opacity: [1, 0.8, 1],
          } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          className={`
            font-mono text-lg font-bold
            ${status === "critical" ? "text-semantic-error" : ""}
            ${status === "warning" ? "text-semantic-warning" : ""}
            ${status === "normal" ? "text-text-primary" : ""}
          `}
        >
          {formatTime(remaining)}
        </motion.span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-surface-border/30 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "linear" }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
        />

        {/* Pulsing effect for critical */}
        {status === "critical" && (
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="absolute inset-0 bg-semantic-error/20"
          />
        )}
      </div>
    </div>
  );
}

interface TimerCircleProps {
  seconds: number;
  totalSeconds: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TimerCircle({
  seconds,
  totalSeconds,
  size = "md",
  className = "",
}: TimerCircleProps) {
  const progress = Math.max(0, Math.min(100, (seconds / totalSeconds) * 100));

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  const getColor = () => {
    const percentage = (seconds / totalSeconds) * 100;
    if (percentage <= 10) return "#ef4444";
    if (percentage <= 30) return "#eab308";
    return "#c18c5d";
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        {/* Background circle */}
        <path
          className="text-surface-border/30"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        {/* Progress circle */}
        <motion.path
          initial={{ pathLength: 1 }}
          animate={{ pathLength: progress / 100 }}
          transition={{ duration: 0.5 }}
          stroke={getColor()}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="100"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-mono font-bold ${textClasses[size]} ${seconds <= 10 ? "text-semantic-error" : "text-text-primary"}`}>
          {formatTime(seconds)}
        </span>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface CountdownProps {
  seconds: number;
  onComplete?: () => void;
  className?: string;
}

export function Countdown({ seconds, onComplete, className = "" }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={timeLeft <= 10 ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 1, repeat: timeLeft <= 10 ? Infinity : 0 }}
      className={`font-mono text-4xl font-bold ${className} ${timeLeft <= 10 ? "text-semantic-error" : "text-text-primary"}`}
    >
      {formatTime(timeLeft)}
    </motion.div>
  );
}
