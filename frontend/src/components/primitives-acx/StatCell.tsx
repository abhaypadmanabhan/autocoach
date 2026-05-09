import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCellProps {
  label: string;
  value: string | number;
  delta?: number;
  unit?: string;
  className?: string;
}

export function StatCell({ label, value, delta, unit, className }: StatCellProps) {
  return (
    <div
      className={cn(
        "border border-[var(--line-subtle)] bg-[var(--bg-base)] rounded-md",
        "p-4 flex flex-col gap-1",
        className,
      )}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[28px] tabular-nums text-[var(--fg-primary)] tracking-[-0.02em]">
          {value}
        </span>
        {unit && <span className="text-[12px] text-[var(--fg-tertiary)]">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div
          className={cn(
            "inline-flex items-center gap-1 font-mono text-[11px]",
            delta > 0 && "text-[var(--success)]",
            delta < 0 && "text-[var(--danger)]",
            delta === 0 && "text-[var(--fg-tertiary)]",
          )}
        >
          {delta > 0 ? (
            <ArrowUp className="h-3 w-3" />
          ) : delta < 0 ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          <span>
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        </div>
      )}
    </div>
  );
}
