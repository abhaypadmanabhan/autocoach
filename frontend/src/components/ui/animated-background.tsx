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

// Warm aurora background — OLED dark with brand-derived coral/gold/teal orbs
// Used exclusively on the landing page to keep other pages unaffected
export function WarmAuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden warm-aurora-bg pointer-events-none", className)}>
      {/* Coral orb — brand-derived, upper-left */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full animate-warm-drift"
        style={{
          background: "radial-gradient(circle, var(--pop-coral) 0%, transparent 70%)",
          opacity: 0.06,
          top: "-15%",
          left: "-10%",
        }}
      />
      {/* Gold orb — brand-derived, lower-right */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-warm-drift-slow"
        style={{
          background: "radial-gradient(circle, var(--pop-gold) 0%, transparent 70%)",
          opacity: 0.05,
          bottom: "-10%",
          right: "-8%",
        }}
      />
      {/* Teal orb — cool complement, center */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-mesh-orb-1"
        style={{
          background: "radial-gradient(circle, var(--pop-teal) 0%, transparent 70%)",
          opacity: 0.04,
          top: "30%",
          right: "25%",
        }}
      />
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
