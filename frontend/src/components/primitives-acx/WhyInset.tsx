import { splitExplanation } from "@/lib/explanation";
import { cn } from "@/lib/utils";

// A question's explanation, with its page or slide citation (when the
// backend supplied one) set on its own line under the text.
export function Explanation({ text }: { text: string }) {
  const { body, source } = splitExplanation(text);
  if (!body && !source) return null;
  return (
    <WhyInset
      footer={
        source && (
          <>
            From {source.kind}{" "}
            <span className="font-mono tabular-nums">{source.number}</span> of
            your document
          </>
        )
      }
    >
      {body}
    </WhyInset>
  );
}

export function WhyInset({
  label = "Why",
  children,
  footer,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-3 px-4 rounded-none bg-[var(--bg-inset)] border border-[var(--line-subtle)] border-l-2 border-l-[var(--accent)]",
        className,
      )}
    >
      <span className="block mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
        {label}
      </span>
      <p className="m-0 text-[14px] leading-[1.55] text-[var(--fg-secondary)]">
        {children}
      </p>
      {footer && (
        <p className="m-0 mt-2 pt-2 border-t border-[var(--line-subtle)] text-[13px] text-[var(--fg-tertiary)]">
          {footer}
        </p>
      )}
    </div>
  );
}
