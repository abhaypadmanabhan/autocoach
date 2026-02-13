"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, CircleDot } from "lucide-react";
import { scoreCircleVariants, scoreTextVariants, satelliteVariants } from "@/lib/motions";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ============================================
// Score tier helpers
// ============================================

function getScoreColor(percent: number) {
  if (percent >= 80) return "#22c55e";
  if (percent >= 60) return "#c18c5d";
  if (percent >= 40) return "#eab308";
  return "#ef4444";
}

function getScoreTierBg(percent: number) {
  if (percent >= 80) return "bg-[#22c55e]";
  if (percent >= 60) return "bg-[#c18c5d]";
  if (percent >= 40) return "bg-[#eab308]";
  return "bg-[#ef4444]";
}

// ============================================
// ScoreHero — the new centered results display
// ============================================

interface QuestionResult {
  is_correct: boolean;
}

interface ScoreHeroProps {
  scorePercent: number;
  correct: number;
  incorrect: number;
  total: number;
  questions: QuestionResult[];
  className?: string;
}

export function ScoreHero({
  scorePercent,
  correct,
  incorrect,
  total,
  questions,
  className = "",
}: ScoreHeroProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [countingDone, setCountingDone] = useState(false);
  const color = getScoreColor(scorePercent);

  // Animate score counting up
  useEffect(() => {
    const duration = 1400;
    const steps = 50;
    const increment = scorePercent / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= scorePercent) {
        setDisplayScore(scorePercent);
        clearInterval(timer);
        setCountingDone(true);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [scorePercent]);

  // Arc geometry for a 240-degree gauge
  const arcRadius = 80;
  const arcStroke = 8;
  const viewSize = 200;
  const cx = viewSize / 2;
  const cy = viewSize / 2 + 10;
  // Start at 210deg, sweep 240deg clockwise (bottom-centered opening)
  const startAngle = 150; // degrees
  const sweepAngle = 240;
  const endAngle = startAngle + sweepAngle;

  const polarToCart = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + arcRadius * Math.cos(rad),
      y: cy + arcRadius * Math.sin(rad),
    };
  };

  const start = polarToCart(startAngle);
  const end = polarToCart(endAngle);
  const largeArc = sweepAngle > 180 ? 1 : 0;

  const arcPath = `M ${start.x} ${start.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  // Calculate stroke-dasharray for the arc
  const arcLength = (sweepAngle / 360) * 2 * Math.PI * arcRadius;
  const filledLength = (scorePercent / 100) * arcLength;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Gauge + score number */}
      <div className="relative w-[200px] h-[180px] mb-2">
        {/* Subtle glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-3xl"
          style={{ backgroundColor: color }}
        />

        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          className="w-full h-full"
          fill="none"
        >
          {/* Background arc */}
          <path
            d={arcPath}
            stroke="var(--surface-border)"
            strokeWidth={arcStroke}
            strokeLinecap="round"
            fill="none"
            opacity={0.3}
          />

          {/* Filled arc */}
          <motion.path
            d={arcPath}
            stroke={color}
            strokeWidth={arcStroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLength}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: arcLength - filledLength }}
            transition={{ duration: 1.5, ease: [0.33, 1, 0.68, 1], delay: 0.2 }}
          />

          {/* Tick marks at 0%, 50%, 100% positions */}
          {[0, 0.5, 1].map((pct) => {
            const angle = startAngle + sweepAngle * pct;
            const inner = polarToCartFn(cx, cy, arcRadius - 14, angle);
            const outer = polarToCartFn(cx, cy, arcRadius - 18, angle);
            return (
              <line
                key={pct}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--surface-border)"
                strokeWidth={1.5}
                opacity={0.4}
              />
            );
          })}
        </svg>

        {/* Center number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.8 }}
          className="absolute inset-0 flex flex-col items-center justify-center pt-3"
        >
          <motion.span
            key={displayScore}
            className="text-5xl font-bold tracking-tight"
            style={{ color }}
          >
            {displayScore}
            <span className="text-2xl font-medium opacity-70">%</span>
          </motion.span>
        </motion.div>

        {/* Pulse ring on count complete */}
        {countingDone && (
          <motion.div
            initial={{ opacity: 0.4, scale: 0.85 }}
            animate={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border"
            style={{ borderColor: color }}
          />
        )}
      </div>

      {/* Stat cards row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="grid grid-cols-3 gap-3 w-full max-w-sm mb-5"
      >
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[var(--semantic-success)]/8 border border-[var(--semantic-success)]/20">
          <CheckCircle2 size={16} className="text-[var(--semantic-success)] opacity-70" />
          <span className="text-xl font-bold text-[var(--semantic-success)]">{correct}</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Correct</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[var(--semantic-error)]/8 border border-[var(--semantic-error)]/20">
          <XCircle size={16} className="text-[var(--semantic-error)] opacity-70" />
          <span className="text-xl font-bold text-[var(--semantic-error)]">{incorrect}</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Wrong</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[var(--brand-primary)]/8 border border-[var(--brand-primary)]/20">
          <CircleDot size={16} className="text-[var(--brand-primary)] opacity-70" />
          <span className="text-xl font-bold text-[var(--text-primary)]">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Total</span>
        </div>
      </motion.div>

      {/* Question result dots */}
      {questions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex items-center gap-1.5 flex-wrap justify-center"
        >
          {questions.map((q, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.0 + i * 0.08, type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "w-3 h-3 rounded-full",
                q.is_correct
                  ? "bg-[var(--semantic-success)]"
                  : "bg-[var(--semantic-error)]"
              )}
              title={`Q${i + 1}: ${q.is_correct ? "Correct" : "Wrong"}`}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Helper for tick marks
function polarToCartFn(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ============================================
// ScoreCircle — legacy, kept for other uses
// ============================================

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
  const [countingDone, setCountingDone] = useState(false);

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
        setCountingDone(true);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [percentage]);

  const sizeClasses = { sm: "w-32 h-32", md: "w-48 h-48", lg: "w-64 h-64" };
  const textSizes = { sm: "text-3xl", md: "text-5xl", lg: "text-6xl" };
  const strokeWidth = { sm: 3, md: 4, lg: 5 };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 rounded-full blur-3xl"
        style={{ backgroundColor: getScoreColor(percentage) }}
      />
      {countingDone && (
        <motion.div
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border-2 z-10"
          style={{ borderColor: getScoreColor(percentage) }}
        />
      )}
      <svg className={`${sizeClasses[size]} -rotate-90 relative z-10`} viewBox="0 0 36 36">
        <path
          className="text-surface-border/30"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="currentColor" strokeWidth={strokeWidth[size]}
        />
        <motion.path
          variants={scoreCircleVariants} initial="hidden" animate="visible"
          stroke={getScoreColor(percentage)}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" strokeWidth={strokeWidth[size]} strokeLinecap="round"
          strokeDasharray="100" style={{ strokeDashoffset: 100 - percentage }}
        />
      </svg>
      <motion.div
        variants={scoreTextVariants} initial="hidden" animate="visible"
        className="absolute inset-0 flex flex-col items-center justify-center z-20"
      >
        <motion.span key={displayScore} initial={{ filter: "blur(4px)" }} animate={{ filter: "blur(0px)" }}
          className={`${textSizes[size]} font-bold text-text-primary`}
        >{displayScore}%</motion.span>
        <span className="text-text-muted text-sm uppercase tracking-wider mt-1">{label}</span>
      </motion.div>
    </div>
  );
}

// ============================================
// InlineStats
// ============================================

interface InlineStatsProps {
  correct: number;
  total: number;
  className?: string;
}

export function InlineStats({ correct, total, className = "" }: InlineStatsProps) {
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className={`space-y-2 ${className}`}
    >
      <p className="text-sm font-medium text-[var(--text-secondary)]">
        <span className="text-lg font-bold text-[var(--text-primary)]">{correct}</span>
        {" "}of{" "}
        <span className="text-lg font-bold text-[var(--text-primary)]">{total}</span>
        {" "}correct
      </p>
      <Progress
        value={percent}
        className="h-2.5 w-full max-w-xs bg-[var(--surface-border)]/30"
        indicatorClassName={getScoreTierBg(percent)}
      />
    </motion.div>
  );
}

// ============================================
// StatSatellite — kept for backward compat
// ============================================

interface StatSatelliteProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  orbitDelay?: number;
  className?: string;
}

export function StatSatellite({ icon, label, value, orbitDelay = 0, className = "" }: StatSatelliteProps) {
  return (
    <motion.div custom={orbitDelay} variants={satelliteVariants} initial="hidden" animate="visible"
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface-card border border-surface-border ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">{icon}</div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      </div>
    </motion.div>
  );
}

// ============================================
// ScoreBreakdown — kept for backward compat
// ============================================

interface ScoreBreakdownProps {
  correct: number;
  incorrect: number;
  total: number;
  timeTaken?: string;
  className?: string;
}

export function ScoreBreakdown({ correct, incorrect, total, timeTaken, className = "" }: ScoreBreakdownProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}
    >
      <div className="text-center p-4 rounded-xl bg-surface-card border border-surface-border">
        <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{correct}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Correct</p>
      </div>
      <div className="text-center p-4 rounded-xl bg-surface-card border border-surface-border">
        <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>{incorrect}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Wrong</p>
      </div>
      <div className="text-center p-4 rounded-xl bg-surface-card border border-surface-border">
        <p className="text-2xl font-bold" style={{ color: "#cd776a" }}>{total}</p>
        <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Total</p>
      </div>
      {timeTaken && (
        <div className="text-center p-4 rounded-xl bg-surface-card border border-surface-border">
          <p className="text-2xl font-bold" style={{ color: "#c18c5d" }}>{timeTaken}</p>
          <p className="text-xs text-text-muted uppercase tracking-wider mt-1">Time</p>
        </div>
      )}
    </motion.div>
  );
}
