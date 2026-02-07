"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import { cn } from "@/lib/utils";

// Animated gradient orbs that float around
export function FloatingOrbs({ className }: { className?: string }) {
  const orbs = [
    { color: "var(--brand-primary)", size: 300, x: "20%", y: "30%", duration: 20 },
    { color: "var(--brand-secondary)", size: 400, x: "70%", y: "60%", duration: 25 },
    { color: "var(--brand-primary)", size: 250, x: "80%", y: "20%", duration: 18 },
    { color: "var(--brand-secondary)", size: 350, x: "10%", y: "70%", duration: 22 },
  ];

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl opacity-20"
          style={{
            backgroundColor: orb.color,
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
          }}
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -40, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Animated grid pattern
export function AnimatedGrid({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(var(--surface-border) 1px, transparent 1px),
            linear-gradient(90deg, var(--surface-border) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <motion.div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(var(--brand-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--brand-primary) 1px, transparent 1px)
          `,
          backgroundSize: "120px 120px",
        }}
        animate={{
          backgroundPosition: ["0px 0px", "60px 60px"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
);
}

// Particle field with mouse interaction
export function ParticleField({ className, particleCount = 30 }: { className?: string; particleCount?: number }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-[var(--brand-primary)]"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
      
      {/* Mouse follower glow */}
      <motion.div
        className="absolute w-32 h-32 rounded-full bg-[var(--brand-primary)] opacity-10 blur-2xl pointer-events-none"
        animate={{
          x: mousePos.x - 64,
          y: mousePos.y - 64,
        }}
        transition={{
          type: "spring",
          stiffness: 50,
          damping: 20,
        }}
      />
    </div>
  );
}

// Animated wave lines
export function WaveLines({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[200%] h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)] to-transparent opacity-10"
          style={{
            top: `${30 + i * 20}%`,
            left: "-50%",
          }}
          animate={{
            x: ["0%", "50%", "0%"],
          }}
          transition={{
            duration: 15 + i * 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Spotlight effect that follows cursor
export function Spotlight({ className }: { className?: string }) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
    >
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, var(--brand-primary) 0%, transparent 70%)",
          left: `${mousePos.x * 100}%`,
          top: `${mousePos.y * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// Combined animated background for hero section
export function HeroBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Base gradient mesh */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(at 40% 20%, rgba(205, 119, 106, 0.15) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(193, 140, 93, 0.1) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(205, 119, 106, 0.1) 0px, transparent 50%),
            radial-gradient(at 80% 50%, rgba(193, 140, 93, 0.08) 0px, transparent 50%),
            var(--surface-dark)
          `,
        }}
      />
      
      {/* Animated elements */}
      <FloatingOrbs />
      <AnimatedGrid />
      <ParticleField particleCount={25} />
      <Spotlight />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// Section background with subtle animation
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
      <FloatingOrbs />
      <AnimatedGrid />
      <WaveLines />
    </div>
  );
}

// Animated border gradient
export function AnimatedBorder({ 
  className, 
  children 
}: { 
  className?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative rounded-2xl p-[1px] overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(90deg, var(--brand-primary), var(--brand-secondary), var(--brand-primary))",
          backgroundSize: "200% 100%",
        }}
        animate={{
          backgroundPosition: ["0% 50%", "200% 50%", "0% 50%"],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <div className="relative rounded-2xl bg-[var(--surface-card)] h-full">
        {children}
      </div>
    </div>
  );
}
