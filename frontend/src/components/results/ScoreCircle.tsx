"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { scoreCircleVariants, scoreTextVariants, satelliteVariants } from "@/lib/motions";
import type { ReactNode } from "react";

interface ScoreCircleProps {
  score: number;
  total: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreCircle({
  score,
  total,
  label = "Score",
  size = "md",
  className = "",
}: ScoreCircleProps) {
  const percentage = Math.round((score / total) * 100);
  const [displayScore, setDisplayScore] = useState(0);

  // Animate the score counting up
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = percentage / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= percentage) {
        setDisplayScore(percentage);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [percentage]);

  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-48 h-48",
    lg: "w-64 h-64",
  };

  const textSizes = {
    sm: "text-3xl",
    md: "text-5xl",
    lg: "text-6xl",
  };

  const strokeWidth = {
    sm: 3,
    md: 4,
    lg: 5,
  };

  const getScoreColor = () => {
    if (percentage >= 80) return "#22c55e";
    if (percentage >= 60) return "#c18c5d";
    if (percentage >= 40) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Background glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.3, scale: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 rounded-full blur-3xl"
        style={{ backgroundColor: getScoreColor() }}
      />

      <svg
        className={`${sizeClasses[size]} -rotate-90 relative z-10`}
        viewBox="0 0 36 36"
      >
        {/* Background circle */}
        <path
          className="text-surface-border/30"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth[size]}
        />

        {/* Score progress */}
        <motion.path
          variants={scoreCircleVariants}
          initial="hidden"
          animate="visible"
          stroke={getScoreColor()}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          strokeWidth={strokeWidth[size]}
          strokeLinecap="round"
          strokeDasharray="100"
          style={{
            strokeDashoffset: 100 - percentage,
          }}
        />
      </svg>

      {/* Center content */}
      <motion.div
        variants={scoreTextVariants}
        initial="hidden"
        animate="visible"
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
      >
        <motion.span
          key={displayScore}
          initial={{ filter: "blur(4px)" }}
          animate={{ filter: "blur(0px)" }}
          className={`${textSizes[size]} font-bold text-text-primary`}
        >
          {displayScore}%
        </motion.span>
        <span className="text-text-muted text-sm uppercase tracking-wider mt-1">
          {label}
        </span>
      </motion.div>
    </div>
  );
}

interface StatSatelliteProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  orbitDelay?: number;
  className?: string;
}

export function StatSatellite({
  icon,
  label,
  value,
  orbitDelay = 0,
  className = "",
}: StatSatelliteProps) {
  return (
    <motion.div
      custom={orbitDelay}
      variants={satelliteVariants}
      initial="hidden"
      animate="visible"
      className={`
        flex flex-col items-center gap-2
        p-4 rounded-2xl bg-surface-card border border-surface-border
        ${className}
      `}
    >
      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      </div>
    </motion.div>
  );
}

interface OrbitingStatProps {
  icon: ReactNode;
  value: string | number;
  angle: number; // 0-360 degrees
  distance: number; // distance from center in pixels
  delay?: number;
}

export function OrbitingStat({
  icon,
  value,
  angle,
  distance,
  delay = 0,
}: OrbitingStatProps) {
  const radians = (angle * Math.PI) / 180;
  const x = Math.cos(radians) * distance;
  const y = Math.sin(radians) * distance;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        x,
        y,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        delay: 0.5 + delay,
      }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-card border border-surface-border shadow-lg">
        <div className="text-brand-primary">{icon}</div>
        <span className="text-sm font-bold text-text-primary">{value}</span>
      </div>
    </motion.div>
  );
}

interface ScoreBreakdownProps {
  correct: number;
  incorrect: number;
  total: number;
  timeTaken?: string;
  className?: string;
}

export function ScoreBreakdown({
  correct,
  incorrect,
  total,
  timeTaken,
  className = "",
}: ScoreBreakdownProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
      >
        <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>
          {correct}
        </p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
          Correct
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
      >
        <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
          {incorrect}
        </p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
          Wrong
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
      >
        <p className="text-2xl font-bold" style={{ color: "#cd776a" }}>
          {total}
        </p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
          Total
        </p>
      </motion.div>

      {timeTaken && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center p-4 rounded-xl bg-surface-card border border-surface-border"
        >
          <p className="text-2xl font-bold" style={{ color: "#c18c5d" }}>
            {timeTaken}
          </p>
          <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
            Time
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
