"use client";

import { cn } from "@/lib/utils";

// Subtle gradient mesh - CSS-animated for performance
export function GradientMesh({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {/* Primary gradient orb - CSS animated */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-[0.03] animate-mesh-orb-1"
        style={{
          background: "radial-gradient(circle, var(--brand-primary) 0%, transparent 70%)",
          top: "-20%",
          left: "-10%",
        }}
      />

      {/* Secondary gradient orb - CSS animated */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03] animate-mesh-orb-2"
        style={{
          background: "radial-gradient(circle, var(--brand-secondary) 0%, transparent 70%)",
          bottom: "-10%",
          right: "-5%",
        }}
      />
    </div>
  );
}

// Hero background - subtle gradient with mesh
export function HeroBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(at 40% 20%, rgba(205, 119, 106, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(193, 140, 93, 0.05) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(205, 119, 106, 0.05) 0px, transparent 50%),
            var(--surface-dark)
          `,
        }}
      />

      {/* Subtle animated mesh */}
      <GradientMesh />
    </div>
  );
}

// Section background - minimal, follows design system
export function SectionBackground({
  className,
  variant = "default"
}: {
  className?: string;
  variant?: "default" | "gradient" | "mesh";
}) {
  const backgrounds = {
    default: "bg-[var(--surface-dark)]",
    gradient: "bg-gradient-to-b from-[var(--surface-dark)] to-[var(--surface-darker)]",
    mesh: "bg-[var(--surface-darker)]",
  };

  return (
    <div className={cn("absolute inset-0 overflow-hidden", backgrounds[variant], className)}>
      <GradientMesh />
    </div>
  );
}
