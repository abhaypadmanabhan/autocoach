import * as React from "react";
import { cn } from "@/lib/utils";

interface BrandMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

/**
 * AutoCoach monogram: italic slab "A" with a green diamond in the
 * counter. Ink glyph on transparent ground so it sits on cream;
 * flat fills only, sharp corners except the original's foot curve.
 */
export function LogoGlyph({
  size = 22,
  glyphColor = "var(--ink)",
  diamondColor = "var(--accent)",
  className,
}: {
  size?: number;
  glyphColor?: string;
  diamondColor?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* top bar + diagonal stroke + curved foot */}
      <path
        d="M50 12 H74 V36 L48 84 H18 V72 C18 63 20 57 24 50 L43 19 C45 14.5 47 12 50 12 Z"
        fill={glyphColor}
      />
      {/* right leg with outward step */}
      <path d="M78 46 H84 L90 52 V84 H60 Z" fill={glyphColor} />
      {/* diamond in the counter */}
      <path d="M67 52.5 L71 58 L67 63.5 L63 58 Z" fill={diamondColor} />
    </svg>
  );
}

export function BrandMark({ size = 22, className, ...props }: BrandMarkProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn("grid place-items-center", className)}
      {...props}
    >
      <LogoGlyph size={size} />
    </div>
  );
}

/**
 * Larger decorative variant of the signature: hairline with a
 * right-angle connector drop and three nodes. For landing/auth.
 */
export function SignatureMotif({
  width = 96,
  className,
}: {
  width?: number;
  className?: string;
}) {
  const height = Math.round(width * 0.42);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 96 40"
      fill="none"
      aria-hidden
      className={className}
    >
      <line x1="0" y1="12" x2="96" y2="12" stroke="var(--ink)" strokeWidth="1" />
      <polyline points="72,12 72,30 88,30" stroke="var(--ink)" strokeWidth="1" fill="none" />
      <circle cx="10" cy="12" r="4" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1" />
      <circle cx="40" cy="12" r="3.2" fill="var(--bg-base)" stroke="var(--ink)" strokeWidth="1.2" />
      <circle cx="88" cy="30" r="3.2" fill="var(--bg-base)" stroke="var(--ink)" strokeWidth="1.2" />
    </svg>
  );
}
