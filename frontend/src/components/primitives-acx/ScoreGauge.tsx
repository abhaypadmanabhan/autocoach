"use client";

import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  perQuestion?: boolean[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { width: 280, height: 120, num: 56 },
  md: { width: 460, height: 180, num: 84 },
  lg: { width: 540, height: 220, num: 96 },
} as const;

export function ScoreGauge({
  score,
  perQuestion,
  size = "lg",
  className,
}: ScoreGaugeProps) {
  const dims = sizes[size];
  const bars = perQuestion ?? Array.from({ length: 10 }, (_, i) => i / 10 < score / 100);
  const barWidth = (dims.width - 32) / bars.length;
  const baseY = dims.height - 16;

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      style={{ width: dims.width }}
    >
      <svg
        width={dims.width}
        height={dims.height - 60}
        viewBox={`0 0 ${dims.width} ${dims.height - 60}`}
        className="overflow-visible"
      >
        {bars.map((isCorrect, i) => {
          const targetH = isCorrect ? Math.max(20, ((dims.height - 80) * (i + 1)) / bars.length) : 12;
          return (
            <rect
              key={i}
              x={16 + i * barWidth + 2}
              y={baseY - 60 - targetH}
              width={Math.max(2, barWidth - 4)}
              height={targetH}
              rx={2}
              className={cn(
                "anim-bar-rise origin-bottom",
                isCorrect ? "fill-[var(--accent)]" : "fill-[var(--line-default)]",
              )}
              style={{
                animationDelay: `${i * 60}ms`,
              }}
            />
          );
        })}
        <line
          x1={16}
          y1={baseY - 60}
          x2={dims.width - 16}
          y2={baseY - 60}
          className="stroke-[var(--line-subtle)]"
          strokeWidth={1}
        />
      </svg>
      <div
        className="mt-3 font-mono tabular-nums text-[var(--fg-primary)] tracking-[-0.04em] leading-none"
        style={{ fontSize: dims.num }}
      >
        {Math.round(score)}
        <span className="text-[var(--fg-tertiary)] text-[0.4em]">%</span>
      </div>
    </div>
  );
}
