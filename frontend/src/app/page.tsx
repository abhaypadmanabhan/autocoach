"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  useInView,
} from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Brain,
  BarChart3,
  FileUp,
  Zap,
  ChevronDown,
  Star,
  Twitter,
  Linkedin,
  Github,
  Check,
  Lightbulb,
  Target,
  Clock,
  BookOpen,
  Layers,
  TrendingUp,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WarmAuroraBackground } from "@/components/ui/animated-background";
import { Logo } from "@/components/brand/Logo";
import { MascotGuide } from "@/components/brand/MascotGuide";
import { SentinelMascot } from "@/components/brand/SentinelMascot";
import { BgAnimateButton } from "@/components/ui/bg-animate-button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Typewriter } from "@/components/ui/typewriter";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// INLINE HELPERS
// ─────────────────────────────────────────────

function SpotlightCard({
  children,
  className,
  glowColor = "var(--brand-primary)",
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("relative overflow-hidden", className)}
    >
      {hovered && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 z-10"
          style={{
            background: `radial-gradient(300px circle at ${pos.x}px ${pos.y}px, ${glowColor}18, transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

function DirectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<"top" | "bottom" | "left" | "right">("bottom");

  const getDir = (
    e: React.MouseEvent,
    el: HTMLDivElement
  ): "top" | "bottom" | "left" | "right" => {
    const { width, height, left, top } = el.getBoundingClientRect();
    const angle =
      (Math.atan2(e.clientY - top - height / 2, e.clientX - left - width / 2) *
        180) /
      Math.PI;
    if (angle > -45 && angle <= 45) return "right";
    if (angle > 45 && angle <= 135) return "bottom";
    if (angle > 135 || angle <= -135) return "left";
    return "top";
  };

  const slideFrom: Record<string, { x?: string; y?: string }> = {
    top: { y: "-100%" },
    bottom: { y: "100%" },
    left: { x: "-100%" },
    right: { x: "100%" },
  };

  return (
    <div
      ref={ref}
      onMouseEnter={(e) => {
        if (ref.current) setDir(getDir(e, ref.current));
      }}
      className={cn("relative overflow-hidden group", className)}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[var(--pop-coral)]/10 to-[var(--pop-teal)]/10 z-0"
        initial={{ ...slideFrom[dir], opacity: 0 }}
        whileHover={{ x: 0, y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
      {children}
    </div>
  );
}

type UtoVariant =
  | "neutral"
  | "smiling"
  | "proud"
  | "pleading"
  | "thinking"
  | "timesUp"
  | "wrong";

function UtoBubble({
  message,
  side,
}: {
  message: string;
  side: "left" | "right";
}) {
  return (
    <div className="relative bg-[var(--surface-card)] border border-[var(--brand-primary)]/30 rounded-2xl px-5 py-4 shadow-lg shadow-[var(--pop-coral)]/10 max-w-[280px]">
      <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
        {message}
      </p>
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-0 h-0 border-y-[8px] border-y-transparent",
          side === "right"
            ? "-right-2 border-l-[8px] border-l-[var(--surface-card)]"
            : "-left-2 border-r-[8px] border-r-[var(--surface-card)]"
        )}
      />
    </div>
  );
}

function UtoWithBubble({
  variant,
  message,
  position = "right",
  size = "md",
}: {
  variant: UtoVariant;
  message: string;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "w-24 h-24",
    md: "w-32 h-32",
    lg: "w-44 h-44",
    xl: "w-64 h-64",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: position === "right" ? 30 : -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex items-end gap-4 mt-8",
        position === "right" ? "justify-end" : "justify-start"
      )}
    >
      {position === "right" && <UtoBubble message={message} side="right" />}
      <div className={cn("relative shrink-0", sizes[size])}>
        <div className="absolute inset-0 bg-[var(--pop-coral)] opacity-15 blur-2xl rounded-full" />
        <SentinelMascot variant={variant} className="w-full h-full" />
      </div>
      {position === "left" && <UtoBubble message={message} side="left" />}
    </motion.div>
  );
}

function AnimatedStat({
  value,
  numericValue,
  label,
  sublabel,
  delay = 0,
  inView,
}: {
  value: string;
  numericValue?: number;
  label: string;
  sublabel: string;
  delay?: number;
  inView: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="text-center"
    >
      <div className="text-numeral gradient-text-warm font-extrabold leading-none mb-3">
        {numericValue !== undefined && inView ? (
          <AnimatedNumber
            value={numericValue}
            stiffness={60}
            damping={20}
          />
        ) : (
          value
        )}
        {numericValue !== undefined && value.endsWith("%") && inView && (
          <span>%</span>
        )}
        {numericValue !== undefined && value.endsWith("+") && inView && (
          <span>+</span>
        )}
      </div>
      <div className="text-lg font-semibold text-[var(--text-primary)] mb-1">
        {label}
      </div>
      <div className="text-sm text-[var(--text-secondary)]">{sublabel}</div>
    </motion.div>
  );
}

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────

function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled
            ? "border-b"
            : "bg-transparent"
        )}
        style={
          isScrolled
            ? {
                background: "rgba(15,15,20,0.92)",
                backdropFilter: "blur(20px)",
                borderColor: "transparent",
                borderImage:
                  "linear-gradient(90deg, var(--brand-primary), var(--pop-coral), transparent) 1",
              }
            : {}
        }
      >
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="flex h-16 lg:h-20 items-center justify-between">
            <Link href="/" className="flex items-center">
              <Logo size="lg" animated />
            </Link>

            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-[var(--text-secondary)]">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <BgAnimateButton
                  gradient="sunset"
                  animation="spin"
                  rounded="full"
                  size="sm"
                  shadow="soft"
                >
                  Get Started Free
                </BgAnimateButton>
              </Link>
            </div>

            <button
              className="lg:hidden text-[var(--text-secondary)] p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-16 inset-x-0 z-40 p-6 flex flex-col gap-4 border-b border-[var(--surface-border)]"
            style={{ background: "rgba(15,15,20,0.97)", backdropFilter: "blur(20px)" }}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[var(--text-primary)] font-medium py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3 border-t border-[var(--surface-border)]">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full">Sign In</Button>
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}>
                <BgAnimateButton gradient="sunset" animation="spin" rounded="full" className="w-full">
                  Get Started Free
                </BgAnimateButton>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────

function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const y = useTransform(smoothProgress, [0, 1], [0, shouldReduceMotion ? 0 : 100]);
  const opacity = useTransform(smoothProgress, [0, 0.6], [1, 0]);

  const wordVariants = {
    hidden: { opacity: 0, y: "60%", skewY: 4 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      skewY: 0,
      transition: {
        delay: 0.1 + i * 0.08,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
  };

  const line1 = "Drop a document.".split(" ");
  const line2 = "Become unstoppable.".split(" ");

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center overflow-hidden pt-20"
      style={{ background: "var(--surface-oled)" }}
    >
      <WarmAuroraBackground />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8 w-full py-20 lg:py-32"
      >
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--pop-coral)]/30 bg-[var(--pop-coral)]/5 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--pop-coral)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--pop-coral)]" />
              </span>
              <span className="text-xs font-semibold text-[var(--pop-coral)] tracking-wider uppercase">
                Now powered by Kimi K2.5 AI
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-hero font-extrabold mb-6 overflow-hidden">
              <div className="flex flex-wrap gap-x-[0.25em] overflow-hidden mb-1">
                {line1.map((word, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={wordVariants}
                    className="inline-block text-[var(--text-primary)]"
                  >
                    {word}
                  </motion.span>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-[0.25em] overflow-hidden">
                {line2.map((word, i) => (
                  <motion.span
                    key={i}
                    custom={line1.length + i}
                    initial="hidden"
                    animate="visible"
                    variants={wordVariants}
                    className="inline-block gradient-text-warm"
                  >
                    {word}
                  </motion.span>
                ))}
              </div>
            </h1>

            {/* Subtext */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed h-8"
            >
              <Typewriter
                delay={0.03}
                baseText="Study smarter, not harder."
                texts={[
                  "Remember 10× more.",
                  "Ace your next exam.",
                  "Built on spaced repetition.",
                  "Study smarter, not harder.",
                ]}
              />
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="flex flex-wrap items-center gap-4"
            >
              <Link href="/register">
                <BgAnimateButton
                  gradient="sunset"
                  animation="pulse"
                  rounded="full"
                  size="lg"
                  shadow="deep"
                >
                  <span className="flex items-center gap-2">
                    Create Your First Quiz
                    <ArrowRight size={16} />
                  </span>
                </BgAnimateButton>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-[var(--surface-border)] hover:border-[var(--brand-primary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Watch Demo
              </Button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="flex items-center gap-3 mt-8"
            >
              <div className="flex -space-x-2">
                {["A", "B", "C", "D"].map((l, i) => (
                  <div
                    key={l}
                    className="w-8 h-8 rounded-full border-2 border-[var(--surface-oled)] flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, var(--pop-coral), var(--pop-gold))`,
                      zIndex: 4 - i,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-px">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} className="fill-[var(--pop-gold)] text-[var(--pop-gold)]" />
                  ))}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  10,000+ students learning smarter
                </p>
              </div>
            </motion.div>
          </div>

          {/* RIGHT — Uto + Demo */}
          <div className="flex flex-col items-center gap-6">
            {/* Uto speech bubble + mascot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-end gap-4"
            >
              <div className="relative bg-[var(--surface-card)] border border-[var(--brand-primary)]/30 rounded-2xl px-5 py-4 shadow-xl shadow-[var(--pop-coral)]/10 max-w-[240px]">
                <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                  Hi! I&apos;m Uto — your AI study partner!
                </p>
                <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-l-8 border-l-[var(--surface-card)] border-y-8 border-y-transparent" />
              </div>
              <div className="relative w-36 h-36 lg:w-44 lg:h-44 shrink-0">
                <div className="absolute inset-0 bg-[var(--brand-primary)] opacity-20 blur-3xl rounded-full animate-glow-pulse-primary" />
                <div className="absolute inset-0 bg-[var(--pop-gold)] opacity-10 blur-2xl rounded-full animate-glow-pulse-secondary" />
                <SentinelMascot variant="smiling" className="w-full h-full" />
              </div>
            </motion.div>

            {/* Demo Preview Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-2xl border border-[var(--surface-border)] overflow-hidden shadow-2xl shadow-black/40"
              style={{ background: "var(--surface-card)" }}
            >
              <div
                className="px-4 py-3 flex items-center gap-3 border-b border-[var(--surface-border)]"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-[var(--text-secondary)] font-mono">
                  autocoach.ai — Quiz Session
                </span>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-[var(--pop-coral)] font-semibold uppercase tracking-wider mb-2">
                    Question 3 of 10
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                    What is the primary mechanism of action for spaced repetition?
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "A", text: "Active recall at increasing intervals", correct: true },
                    { label: "B", text: "Passive re-reading of material" },
                    { label: "C", text: "Highlighting key terms" },
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs transition-colors",
                        opt.correct
                          ? "border-[var(--pop-teal)]/50 bg-[var(--pop-teal)]/8 text-[var(--pop-teal)]"
                          : "border-[var(--surface-border)] text-[var(--text-secondary)]"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                          opt.correct
                            ? "bg-[var(--pop-teal)] text-white"
                            : "bg-[var(--surface-border)] text-[var(--text-secondary)]"
                        )}
                      >
                        {opt.correct ? <Check size={10} /> : opt.label}
                      </span>
                      {opt.text}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 rounded-full transition-all",
                          i < 3
                            ? "w-4 bg-[var(--pop-coral)]"
                            : i === 3
                            ? "w-4 bg-[var(--pop-gold)]"
                            : "w-2 bg-[var(--surface-border)]"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)]">30% done</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown size={18} className="text-[var(--pop-coral)]" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────
// PROBLEM SECTION
// ─────────────────────────────────────────────

function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const painPoints = [
    {
      icon: BookOpen,
      title: "Passive reading doesn't encode",
      desc: "Re-reading notes feels productive but barely moves the memory needle.",
    },
    {
      icon: Clock,
      title: "Cramming fades within 48 hours",
      desc: "Without reinforcement, up to 70% of crammed content vanishes by the next morning.",
    },
    {
      icon: Target,
      title: "Generic tools lack context",
      desc: "Flashcard apps don't know your material. AutoCoach reads your actual documents.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-36 overflow-hidden section-deep"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--pop-coral) 0%, transparent 70%)",
            opacity: 0.04,
            top: "10%",
            right: "-10%",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="px-4 py-1.5 rounded-full border border-[var(--pop-coral)]/30 text-xs font-bold text-[var(--pop-coral)] uppercase tracking-wider">
            The Forgetting Curve
          </span>
        </motion.div>

        {/* Stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center mb-6"
        >
          <div className="text-numeral gradient-text-warm font-extrabold leading-none mb-3">
            {isInView && <AnimatedNumber value={70} stiffness={50} damping={20} />}
            <span>%</span>
          </div>
          <h2 className="text-h1 font-bold text-[var(--text-primary)] max-w-2xl mx-auto">
            of what you learn is forgotten within a week.
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-16 leading-relaxed"
        >
          The Ebbinghaus Forgetting Curve has been crushing students since 1885.
          Most study tools do absolutely nothing about it.
        </motion.p>

        {/* Pain point cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid md:grid-cols-3 gap-6 mb-16"
        >
          {painPoints.map((point, i) => (
            <motion.div
              key={point.title}
              variants={sectionVariants}
              custom={i}
              className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)]/50 backdrop-blur-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--pop-coral)]/10 flex items-center justify-center mb-4">
                <point.icon size={20} className="text-[var(--pop-coral)]" />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                {point.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {point.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-12">
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--pop-coral)]/30 to-transparent" />
          <div className="relative px-6 bg-[var(--surface-deep)] text-sm text-[var(--text-secondary)] font-medium">
            The solution
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center text-xl text-[var(--text-primary)] font-medium max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          AutoCoach is built on{" "}
          <span className="gradient-text-warm font-bold">
            active recall + spaced repetition
          </span>{" "}
          — the only scientifically proven methods to beat the curve.
        </motion.p>

        <UtoWithBubble
          variant="thinking"
          message="That's actually true... but I can fix that."
          position="right"
          size="md"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// FEATURES BENTO SECTION
// ─────────────────────────────────────────────

function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const features = [
    {
      icon: Sparkles,
      title: "AI Quiz Generation",
      desc: "Kimi K2.5 reads your documents and generates targeted questions — MCQ, True/False, and free text.",
      glow: "var(--pop-coral)",
      span: "col-span-2 row-span-2",
      hero: true,
    },
    {
      icon: Layers,
      title: "Multi-type Questions",
      desc: "Three question formats to hit different memory pathways.",
      glow: "var(--brand-primary)",
      span: "col-span-1 row-span-1",
    },
    {
      icon: Brain,
      title: "Smart Evaluation",
      desc: "Free-text answers are semantically evaluated by AI — not just keyword matched.",
      glow: "var(--pop-teal)",
      span: "col-span-1 row-span-1",
    },
    {
      icon: FileUp,
      title: "Drop Any File",
      desc: "PDFs and PowerPoints processed in seconds.",
      glow: "var(--brand-secondary)",
      span: "col-span-1 row-span-1",
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking",
      desc: "Session analytics, accuracy trends, and weak-spot identification.",
      glow: "var(--pop-gold)",
      span: "col-span-2 row-span-1",
    },
    {
      icon: Zap,
      title: "Adaptive Difficulty",
      desc: "Questions adapt based on your performance.",
      glow: "var(--pop-coral)",
      span: "col-span-1 row-span-1",
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative py-24 lg:py-36 overflow-hidden section-oled"
    >
      <WarmAuroraBackground />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold text-[var(--pop-teal)] uppercase tracking-wider mb-3 block">
            Features
          </span>
          <h2 className="text-h1 font-bold text-[var(--text-primary)] mb-4">
            Here&apos;s what I bring to the table.
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
            Every feature is built around the science of how memory actually works.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-3 auto-rows-[200px] gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className={cn(feature.span)}
            >
              <SpotlightCard
                glowColor={feature.glow}
                className={cn(
                  "h-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)]/80 p-6 flex flex-col justify-between backdrop-blur-sm transition-all duration-300 hover:border-[var(--surface-border)]/80",
                  feature.hero && "relative overflow-hidden"
                )}
              >
                {feature.hero && (
                  <div className="absolute top-4 right-4 w-20 h-20 opacity-90">
                    <SentinelMascot variant="proud" className="w-full h-full" />
                  </div>
                )}
                <div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${feature.glow}18` }}
                  >
                    <feature.icon
                      size={20}
                      style={{ color: feature.glow }}
                    />
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
                <div
                  className="h-px mt-4"
                  style={{
                    background: `linear-gradient(90deg, ${feature.glow}40, transparent)`,
                  }}
                />
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        <UtoWithBubble
          variant="proud"
          message="Here's what I bring to the table."
          position="right"
          size="md"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// HOW IT WORKS SECTION
// ─────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      icon: FileText,
      title: "Drop Your Files",
      desc: "Upload a PDF or PowerPoint. AutoCoach extracts every sentence, every diagram caption, every footnote — nothing is skipped.",
      mascotVariant: "neutral" as UtoVariant,
      mascotMessage: "Drop your files right here. I'll do the rest.",
      mascotSide: "right" as "left" | "right",
      glow: "var(--pop-coral)",
    },
    {
      number: "02",
      icon: Brain,
      title: "I Analyze Everything",
      desc: "Kimi K2.5 reads your material using RAG — deep semantic understanding, not surface-level keyword search.",
      mascotVariant: "thinking" as UtoVariant,
      mascotMessage: "I read everything. Every. Single. Line.",
      mascotSide: "left" as "left" | "right",
      glow: "var(--pop-teal)",
    },
    {
      number: "03",
      icon: Zap,
      title: "Then I Quiz You. Relentlessly.",
      desc: "Adaptive questions across three formats, tuned to hit your weak spots. Spaced repetition built in from day one.",
      mascotVariant: "proud" as UtoVariant,
      mascotMessage: "Then I quiz you. Relentlessly. It's science.",
      mascotSide: "right" as "left" | "right",
      glow: "var(--pop-gold)",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative py-24 lg:py-36 overflow-hidden section-deep"
    >
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-20">
          <span className="text-xs font-bold text-[var(--pop-gold)] uppercase tracking-wider mb-3 block">
            How It Works
          </span>
          <h2 className="text-h1 font-bold text-[var(--text-primary)] mb-4">
            Three steps to unstoppable.
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto">
            From document to quiz in under 2 minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-28">
          {steps.map((step, idx) => {
            const isEven = idx % 2 === 1;
            return (
              <HowStep
                key={step.number}
                step={step}
                isEven={isEven}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowStep({
  step,
  isEven,
}: {
  step: {
    number: string;
    icon: React.ElementType;
    title: string;
    desc: string;
    mascotVariant: UtoVariant;
    mascotMessage: string;
    mascotSide: "left" | "right";
    glow: string;
  };
  isEven: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div
      ref={ref}
      className={cn(
        "grid lg:grid-cols-2 gap-12 items-center",
        isEven && "lg:[&>*:first-child]:order-2"
      )}
    >
      {/* Content side */}
      <motion.div
        initial={{ opacity: 0, x: isEven ? 40 : -40 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <span
          className="block text-[80px] font-extrabold leading-none mb-4"
          style={{ color: `${step.glow}18` }}
        >
          {step.number}
        </span>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `${step.glow}18` }}
        >
          <step.icon size={24} style={{ color: step.glow }} />
        </div>
        <h3 className="text-h2 font-bold text-[var(--text-primary)] mb-4">
          {step.title}
        </h3>
        <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
          {step.desc}
        </p>
      </motion.div>

      {/* Uto side */}
      <UtoWithBubble
        variant={step.mascotVariant}
        message={step.mascotMessage}
        position={step.mascotSide}
        size="lg"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// STATS SECTION
// ─────────────────────────────────────────────

function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const stats = [
    { value: "10,000+", numericValue: 10000, label: "Students", sublabel: "actively learning", delay: 0 },
    { value: "98%", numericValue: 98, label: "Satisfaction", sublabel: "5-star rating", delay: 0.1 },
    { value: "3×", label: "Retention", sublabel: "vs passive reading", delay: 0.2 },
    { value: "2 min", label: "To first quiz", sublabel: "upload to questions", delay: 0.3 },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden section-oled"
    >
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          className="w-[800px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(ellipse, var(--pop-gold) 0%, transparent 70%)",
            opacity: 0.04,
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold text-[var(--pop-coral)] uppercase tracking-wider mb-3 block">
            By The Numbers
          </span>
          <h2 className="text-h1 font-bold text-[var(--text-primary)]">
            Real students. Real results.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
          {stats.map((stat) => (
            <AnimatedStat key={stat.label} {...stat} inView={isInView} />
          ))}
        </div>

        <UtoWithBubble
          variant="smiling"
          message="These numbers are real. Real students. Real results."
          position="right"
          size="md"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// TESTIMONIALS SECTION
// ─────────────────────────────────────────────

function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const testimonials = [
    {
      quote: "I went from failing my biochem midterms to getting an A-. AutoCoach actually understood my notes.",
      name: "Priya S.",
      role: "Pre-med, Year 3",
      initials: "PS",
    },
    {
      quote: "The questions it generates are scary good. Like it actually *gets* what's important.",
      name: "Marcus T.",
      role: "Computer Science",
      initials: "MT",
    },
    {
      quote: "Two weeks before my bar exam. AutoCoach on 400 pages of notes. Passed first try.",
      name: "Jordan R.",
      role: "Law Graduate",
      initials: "JR",
    },
    {
      quote: "I study half as long and remember twice as much. That's not nothing — that's a superpower.",
      name: "Leila K.",
      role: "MBA Student",
      initials: "LK",
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="relative py-24 lg:py-36 overflow-hidden section-deep"
    >
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-16"
        >
          <span className="text-xs font-bold text-[var(--brand-primary)] uppercase tracking-wider mb-3 block">
            Testimonials
          </span>
          <h2 className="text-h1 font-bold text-[var(--text-primary)]">
            Loved by students everywhere.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
            >
              <DirectionCard className="h-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)]/80 p-6 flex flex-col justify-between backdrop-blur-sm">
                <div className="relative z-10">
                  <div className="flex gap-px mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={13} className="fill-[var(--pop-gold)] text-[var(--pop-gold)]" />
                    ))}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, var(--brand-primary), var(--pop-coral))" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{t.role}</p>
                  </div>
                </div>
              </DirectionCard>
            </motion.div>
          ))}
        </div>

        <UtoWithBubble
          variant="neutral"
          message="Don't just take my word for it..."
          position="left"
          size="md"
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// PRICING SECTION
// ─────────────────────────────────────────────

function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const plans = [
    {
      name: "Free",
      price: { monthly: 0, annual: 0 },
      desc: "Perfect for exploring",
      features: [
        "3 documents per month",
        "Up to 10 questions per quiz",
        "MCQ & True/False only",
        "Basic progress tracking",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      price: { monthly: 12, annual: 9 },
      desc: "For serious students",
      features: [
        "Unlimited documents",
        "Unlimited questions",
        "All question types (incl. free text)",
        "Advanced analytics",
        "Priority AI processing",
        "Export quiz results",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative py-24 lg:py-36 overflow-hidden section-oled"
    >
      <WarmAuroraBackground />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <span className="text-xs font-bold text-[var(--pop-teal)] uppercase tracking-wider mb-3 block">
            Pricing
          </span>
          <h2 className="text-h1 font-bold text-[var(--text-primary)] mb-4">
            Simple, honest pricing.
          </h2>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 mt-6 p-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface-card)]/50">
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                !isAnnual
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--text-secondary)]"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                isAnnual
                  ? "bg-[var(--brand-primary)] text-white"
                  : "text-[var(--text-secondary)]"
              )}
            >
              Annual
              <span className="text-xs bg-[var(--pop-coral)]/20 text-[var(--pop-coral)] px-2 py-0.5 rounded-full font-bold">
                -25%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
            >
              {plan.popular ? (
                <div className="p-[1px] rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] via-[var(--pop-coral)] to-[var(--pop-gold)] shadow-lg shadow-[var(--pop-coral)]/15 h-full">
                  <SpotlightCard
                    glowColor="var(--pop-coral)"
                    className="rounded-[calc(1rem-1px)] bg-[var(--surface-card)] h-full p-7 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <span className="text-xs font-bold text-[var(--pop-coral)] uppercase tracking-wider mb-1 block">
                          Most Popular
                        </span>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">{plan.desc}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-3xl font-extrabold gradient-text-warm">
                            ${isAnnual ? plan.price.annual : plan.price.monthly}
                          </span>
                          <span className="text-sm text-[var(--text-secondary)]">/mo</span>
                        </div>
                        {isAnnual && (
                          <span className="text-xs text-[var(--text-secondary)]">billed annually</span>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                          <Check size={14} className="text-[var(--pop-teal)] shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/register">
                      <BgAnimateButton
                        gradient="sunrise"
                        animation="pulse"
                        rounded="full"
                        className="w-full"
                        shadow="soft"
                      >
                        {plan.cta}
                      </BgAnimateButton>
                    </Link>
                  </SpotlightCard>
                </div>
              ) : (
                <SpotlightCard
                  glowColor="var(--brand-primary)"
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] h-full p-7 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-[var(--text-primary)]">{plan.name}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">{plan.desc}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className="text-3xl font-extrabold text-[var(--text-primary)]">Free</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">forever</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <Check size={14} className="text-[var(--brand-primary)] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button
                      variant="outline"
                      className="w-full rounded-full border-[var(--surface-border)] hover:border-[var(--brand-primary)]/50"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </SpotlightCard>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// FAQ SECTION
// ─────────────────────────────────────────────

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const faqs = [
    {
      q: "What file types does AutoCoach support?",
      a: "Currently PDF and PowerPoint (.pptx) files. We extract all text content including slide notes and document metadata.",
    },
    {
      q: "How are free-text answers evaluated?",
      a: "Your answers are evaluated semantically by Kimi K2.5 — it understands meaning, not just keywords. A correct concept expressed in your own words will be marked correct.",
    },
    {
      q: "Is my document data kept private?",
      a: "Yes. Documents are processed, then stored securely in your private account. We never use your content to train models or share it with third parties.",
    },
    {
      q: "How is this different from Anki or Quizlet?",
      a: "Anki and Quizlet require you to manually create cards. AutoCoach reads your documents and generates contextual questions automatically — then adapts to your weak spots.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Cancel anytime from your account settings. No lock-in, no cancellation fees.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden section-deep"
    >
      <div className="absolute inset-0 opacity-50 pointer-events-none warm-aurora-bg" />

      <div className="relative z-10 mx-auto max-w-[720px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-14"
        >
          <span className="text-xs font-bold text-[var(--pop-gold)] uppercase tracking-wider mb-3 block">
            FAQ
          </span>
          <h2 className="text-h1 font-bold text-[var(--text-primary)]">
            Got questions? I&apos;ve got answers.
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "rounded-2xl border transition-colors duration-200 overflow-hidden",
                openIndex === i
                  ? "border-[var(--pop-coral)]/30 bg-[var(--surface-card)]"
                  : "border-[var(--surface-border)] bg-[var(--surface-card)]/50"
              )}
            >
              <button
                className="w-full px-6 py-5 flex items-center justify-between text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="font-semibold text-[var(--text-primary)] text-sm pr-4">
                  {faq.q}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 text-[var(--pop-coral)]"
                >
                  <X size={16} />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="px-6 pb-5 text-sm text-[var(--text-secondary)] leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// FINAL CTA SECTION
// ─────────────────────────────────────────────

function FinalCTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="relative py-32 lg:py-40 overflow-hidden section-oled"
    >
      <WarmAuroraBackground />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, var(--pop-gold) 0%, transparent 60%)",
            opacity: 0.05,
            filter: "blur(80px)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-hero font-extrabold mb-6">
              <span className="text-[var(--text-primary)] block">One quiz.</span>
              <span className="gradient-text-warm block">Could change everything.</span>
            </h2>
            <p className="text-lg text-[var(--text-secondary)] mb-10 leading-relaxed max-w-md">
              Drop a document. Get quizzed. Remember more. It really is that simple.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/register">
                <BgAnimateButton
                  gradient="sunset"
                  animation="pulse"
                  rounded="full"
                  size="lg"
                  shadow="deeper"
                >
                  <span className="flex items-center gap-2">
                    Start for free
                    <ArrowRight size={16} />
                  </span>
                </BgAnimateButton>
              </Link>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-4">
              No credit card. No commitment.
            </p>
          </motion.div>

          {/* Right — Uto + bubble */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative bg-[var(--surface-card)] border border-[var(--brand-primary)]/30 rounded-2xl px-6 py-5 shadow-xl shadow-[var(--pop-coral)]/10 max-w-xs">
              <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                Come on...{" "}
                <span className="text-[var(--pop-coral)] font-bold">one quiz</span> won&apos;t hurt.
                It might just change everything.
              </p>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-t-[10px] border-t-[var(--surface-card)] border-x-[10px] border-x-transparent" />
            </div>
            <div className="relative w-64 h-64 lg:w-72 lg:h-72">
              <div className="absolute inset-0 bg-[var(--pop-coral)] opacity-20 blur-3xl rounded-full animate-glow-pulse-primary" />
              <div className="absolute inset-0 bg-[var(--pop-gold)] opacity-15 blur-2xl rounded-full animate-glow-pulse-secondary" />
              <SentinelMascot variant="pleading" className="w-full h-full" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="relative py-16 border-t border-[var(--surface-border)]"
      style={{ background: "var(--surface-oled)" }}
    >
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo size="lg" animated />
            <p className="text-sm text-[var(--text-secondary)] mt-4 max-w-xs leading-relaxed">
              AI-powered study partner that transforms your documents into intelligent quizzes.
              Built on science. Built for students.
            </p>
            <div className="flex gap-4 mt-6">
              {[
                { Icon: Twitter, href: "#" },
                { Icon: Linkedin, href: "#" },
                { Icon: Github, href: "#" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-9 h-9 rounded-full border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--pop-coral)] hover:border-[var(--pop-coral)]/50 transition-colors duration-200"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Product</h4>
            <ul className="space-y-2.5">
              {["Features", "How It Works", "Pricing", "Changelog"].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--surface-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">
            © {new Date().getFullYear()} AutoCoach. All rights reserved.
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Made with{" "}
            <span className="text-[var(--pop-coral)]">♥</span> for students everywhere.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen"
      style={{ background: "var(--surface-oled)", color: "var(--text-primary)" }}
    >
      <Navigation />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
      <MascotGuide />
    </div>
  );
}
