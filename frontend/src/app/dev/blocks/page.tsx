"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, animate, useInView } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  Loader2,
  Trophy,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Beaker,
  ArrowRight,
  Code2,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
  CardFooter,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
} from "@/components/blocks/formcn/stepper";
import {
  staggerContainer,
  slideUpItem,
  transitions,
} from "@/lib/motions";

// ─── Motion presets (page-scoped) ────────────────────────────────────────────

const sectionReveal = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemReveal = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const cardHover = {
  rest: { y: 0, boxShadow: "0 0 0 0 rgba(205,119,106,0)" },
  hover: {
    y: -2,
    boxShadow: "0 8px 24px -4px rgba(205,119,106,0.1)",
    transition: transitions.snappy,
  },
};

// ─── Animated counter ────────────────────────────────────────────────────────

function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, {
      duration: 1.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return controls.stop;
  }, [isInView, value]);

  const formatted =
    value % 1 !== 0
      ? display.toFixed(1)
      : display >= 1000
        ? Math.round(display).toLocaleString()
        : Math.round(display).toString();

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}

// ─── Section shell ───────────────────────────────────────────────────────────

function LabSection({
  category,
  registry,
  title,
  children,
}: {
  category: string;
  registry: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={sectionReveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemReveal} className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-small text-brand-primary">{category}</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-border/20 text-text-muted">
            {registry}
          </span>
        </div>
        <h2 className="text-h2 font-heading text-text-primary">{title}</h2>
      </motion.div>

      {/* Content container */}
      <motion.div
        variants={itemReveal}
        className="rounded-2xl bg-surface-card/30 border border-surface-border/15 p-6 sm:p-8"
      >
        {children}
      </motion.div>
    </motion.section>
  );
}

// ─── A) Stat cards ───────────────────────────────────────────────────────────

const autocoachStats = [
  {
    title: "Documents",
    value: 47,
    delta: 12.3,
    lastMonth: 42,
    positive: true,
    icon: FileText,
  },
  {
    title: "Ready",
    value: 38,
    delta: 8.6,
    lastMonth: 35,
    positive: true,
    icon: CheckCircle2,
  },
  {
    title: "Processing",
    value: 3,
    delta: -25.0,
    lastMonth: 4,
    positive: true,
    icon: Loader2,
  },
  {
    title: "Avg Score",
    value: 78.4,
    delta: 5.2,
    lastMonth: 74.5,
    positive: true,
    suffix: "%",
    icon: Trophy,
  },
];

function formatStatValue(stat: (typeof autocoachStats)[number]) {
  if ("suffix" in stat && stat.suffix) return `${stat.value}${stat.suffix}`;
  return stat.value.toLocaleString();
}

function formatLastMonth(stat: (typeof autocoachStats)[number]) {
  if ("suffix" in stat && stat.suffix) return `${stat.lastMonth}${stat.suffix}`;
  return stat.lastMonth.toLocaleString();
}

function StatCardsDemo() {
  return (
    <motion.div
      variants={sectionReveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {autocoachStats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div key={i} variants={itemReveal} whileHover="hover" initial="rest" animate="rest">
            <motion.div variants={cardHover}>
              <Card className="bg-surface-card border-surface-border/20 text-text-primary shadow-none">
                <CardHeader>
                  <CardTitle className="text-text-secondary text-sm font-medium flex items-center gap-1.5">
                    <Icon size={14} className="shrink-0 text-text-muted" />
                    {stat.title}
                  </CardTitle>
                  <CardAction>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-me-1.5 text-text-muted hover:text-text-primary hover:bg-surface-border/20"
                        >
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        side="bottom"
                        className="bg-surface-darker border-surface-border/30 text-text-primary"
                      >
                        <DropdownMenuItem className="text-text-secondary hover:text-text-primary focus:bg-surface-border/20 focus:text-text-primary">
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-text-secondary hover:text-text-primary focus:bg-surface-border/20 focus:text-text-primary">
                          Pin to dashboard
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <span className="text-text-primary text-2xl font-semibold tracking-tight tabular-nums">
                    {formatStatValue(stat)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      stat.positive
                        ? "bg-semantic-success/10 text-semantic-success"
                        : "bg-semantic-error/10 text-semantic-error"
                    }`}
                  >
                    {stat.delta > 0 ? (
                      <ArrowUp size={11} />
                    ) : (
                      <ArrowDown size={11} />
                    )}
                    {Math.abs(stat.delta)}%
                  </span>
                </CardContent>
                <CardFooter className="text-text-muted mt-2 border-t border-surface-border/15 pt-3 text-xs">
                  Last month:
                  <span className="text-text-secondary font-medium ml-1">
                    {formatLastMonth(stat)}
                  </span>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── B) Stepper demos ────────────────────────────────────────────────────────

const quizSteps = [
  { title: "Upload", description: "Add your document" },
  { title: "Configure", description: "Choose question types" },
  { title: "Quiz", description: "Answer questions" },
  { title: "Results", description: "Review your score" },
];

/**
 * Scoped wrapper that provides missing shadcn CSS variables
 * so the formcn stepper renders correctly against AutoCoach tokens.
 */
function StepperThemeScope({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={
        {
          "--color-primary": "var(--brand-primary)",
          "--color-primary-foreground": "var(--text-primary)",
          "--color-muted": "rgba(73, 88, 103, 0.4)",
          "--color-muted-foreground": "var(--text-muted)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

function StepperHorizontalDemo() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
        Horizontal — step 2 active
      </p>
      <StepperThemeScope>
        <Stepper value={2} className="w-full">
          {quizSteps.map((step, i) => (
            <StepperItem
              key={i}
              step={i + 1}
              completed={i + 1 < 2}
              className="flex-1"
            >
              <StepperTrigger className="flex-col gap-1">
                <StepperIndicator />
                <div className="text-center">
                  <StepperTitle className="text-text-primary">
                    {step.title}
                  </StepperTitle>
                  <StepperDescription className="hidden sm:block text-text-muted">
                    {step.description}
                  </StepperDescription>
                </div>
              </StepperTrigger>
              {i < quizSteps.length - 1 && <StepperSeparator />}
            </StepperItem>
          ))}
        </Stepper>
      </StepperThemeScope>
    </div>
  );
}

function StepperVerticalDemo() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
        Vertical — step 3 loading
      </p>
      <StepperThemeScope>
        <Stepper value={3} orientation="vertical">
          {quizSteps.map((step, i) => (
            <StepperItem
              key={i}
              step={i + 1}
              completed={i + 1 < 3}
              loading={i + 1 === 3}
            >
              <StepperTrigger>
                <StepperIndicator />
                <div>
                  <StepperTitle className="text-text-primary">
                    {step.title}
                  </StepperTitle>
                  <StepperDescription className="text-text-muted">
                    {step.description}
                  </StepperDescription>
                </div>
              </StepperTrigger>
              {i < quizSteps.length - 1 && <StepperSeparator />}
            </StepperItem>
          ))}
        </Stepper>
      </StepperThemeScope>
    </div>
  );
}

// ─── C) Count-up (shimmer replacement) ───────────────────────────────────────

const countUpStats = [
  { value: 1847, label: "Questions answered", suffix: "" },
  { value: 92.4, label: "Completion rate", suffix: "%" },
  { value: 47, label: "Documents processed", suffix: "" },
];

function CountUpDemo() {
  return (
    <motion.div
      variants={sectionReveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12"
    >
      {countUpStats.map((stat, i) => (
        <motion.div key={i} variants={itemReveal} className="text-center space-y-2">
          <p className="text-numeral font-heading text-text-primary leading-none">
            <AnimatedCounter value={stat.value} suffix={stat.suffix} />
          </p>
          <p className="text-sm text-text-muted">{stat.label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DesignLabPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setAuthed(true);
    });
  }, [router]);

  if (!authed) return null;

  return (
    <AppShell title="Design Lab" showBack backHref="/dashboard">
      {/* Background glows + noise */}
      <div className="gradient-mesh noise-bg min-h-screen">
        <PageContainer size="xl">
          {/* ── Hero ──────────────────────────────────────────────── */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="pt-4 pb-16 space-y-6"
          >
            {/* Pill */}
            <motion.div variants={slideUpItem}>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                <Beaker size={12} />
                UI Lab
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              variants={slideUpItem}
              className="text-h1 font-heading"
            >
              <span className="gradient-text">Design Lab</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={slideUpItem}
              className="text-body text-text-secondary max-w-lg"
            >
              Registry blocks themed to AutoCoach tokens.
              Evaluation only — nothing wired into production.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={slideUpItem} className="flex items-center gap-3 pt-2">
              <button className="pill-btn selected text-sm">
                <Code2 size={15} className="mr-2" />
                Explore Components
              </button>
              <button className="pill-btn text-sm">
                View Source
                <ArrowRight size={14} className="ml-2" />
              </button>
            </motion.div>
          </motion.div>

          {/* ── Hairline ──────────────────────────────────────────── */}
          <div className="hairline mb-16" />

          {/* ── Sections ──────────────────────────────────────────── */}
          <div className="space-y-20 pb-24">
            {/* A) Stat Cards */}
            <LabSection
              category="Dashboard"
              registry="@bundui/stat-cards-01"
              title="Stat Cards"
            >
              <StatCardsDemo />
            </LabSection>

            {/* B) Stepper */}
            <LabSection
              category="Forms"
              registry="@formcn/stepper"
              title="Multi-step Flow"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <StepperHorizontalDemo />
                <StepperVerticalDemo />
              </div>
            </LabSection>

            {/* C) Count-up (replaces shimmer) */}
            <LabSection
              category="Motion"
              registry="framer-motion"
              title="Animated Count-up"
            >
              <CountUpDemo />
            </LabSection>
          </div>
        </PageContainer>
      </div>
    </AppShell>
  );
}
