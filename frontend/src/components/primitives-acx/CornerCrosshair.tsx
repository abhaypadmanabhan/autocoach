import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

export function CornerCrosshair({
  corner,
  size = 16,
  className,
}: {
  corner: Corner;
  size?: number;
  className?: string;
}) {
  const positions: Record<Corner, string> = {
    tl: "top-3 left-3 border-t border-l",
    tr: "top-3 right-3 border-t border-r",
    bl: "bottom-3 left-3 border-b border-l",
    br: "bottom-3 right-3 border-b border-r",
  };

  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "absolute pointer-events-none border-[var(--line-strong)]",
        positions[corner],
        className,
      )}
      aria-hidden
    />
  );
}

export function CornerCrosshairFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CornerCrosshair corner="tl" />
      <CornerCrosshair corner="tr" />
      <CornerCrosshair corner="bl" />
      <CornerCrosshair corner="br" />
      {children}
    </>
  );
}
