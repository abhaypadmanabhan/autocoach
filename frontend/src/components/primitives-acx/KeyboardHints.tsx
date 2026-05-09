import { Kbd } from "./Kbd";
import { cn } from "@/lib/utils";

export interface KeyboardHint {
  keys: string[];
  label: string;
}

export function KeyboardHints({
  hints,
  className,
}: {
  hints: KeyboardHint[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-30 hidden md:flex",
        "items-center gap-4 px-4 py-2 rounded-full",
        "border border-[var(--line-default)] bg-[var(--bg-overlay)]/85 backdrop-blur",
        "shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      {hints.map((hint, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fg-tertiary)]"
        >
          {hint.keys.map((k, j) => (
            <Kbd key={j}>{k}</Kbd>
          ))}
          <span>{hint.label}</span>
        </span>
      ))}
    </div>
  );
}
