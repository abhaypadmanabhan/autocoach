"use client";

import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import { motion, MotionConfig, useInView } from "motion/react";
import {
  ArrowRight,
  Check,
  FileUp,
  Network,
  Repeat,
  Minus,
  Menu,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BrandMark, LogoGlyph, SignatureMotif } from "@/components/primitives-acx/BrandMark";
import { Kbd } from "@/components/primitives-acx/Kbd";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#engine", label: "Engine" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[var(--bg-base)] text-[var(--fg-primary)]">
        <GridBackdrop />
        <Nav />
        <main className="relative">
          <Hero />
          <Problem />
          <HowItWorks />
          <Features />
          <Engine />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Background — drifting hairline grid + traveling signature nodes     */
/* ------------------------------------------------------------------ */

function GridBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* static vertical hairlines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(23,23,23,0.05) 0 1px, transparent 1px 64px)",
        }}
      />
      {/* drifting horizontal hairlines — seamless 64px loop */}
      <div
        className="anim-grid-drift absolute left-0 right-0 top-0 h-[calc(100%+128px)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(23,23,23,0.05) 0 1px, transparent 1px 64px)",
        }}
      />
      {/* traveling nodes — one accent, two ink, very low opacity */}
      <span className="anim-node-x-1 absolute top-[22%] -left-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-40" />
      <span className="anim-node-x-2 absolute top-[57%] -left-2 h-1.5 w-1.5 rounded-full border border-[var(--ink)] opacity-30" />
      <span className="anim-node-x-3 absolute top-[81%] -left-2 h-1 w-1 rounded-full bg-[var(--ink)] opacity-20" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionShell({
  id,
  kicker,
  children,
  className,
}: {
  id?: string;
  kicker: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("relative border-t border-[var(--line-subtle)]", className)}>
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <Reveal>
          <p className="kicker mb-8">{kicker}</p>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function DisplayHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "font-display font-bold uppercase tracking-[-0.02em] leading-[1.02]",
        "text-[clamp(28px,5vw,52px)] text-[var(--fg-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line-subtle)] bg-[var(--bg-base)]">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={24} />
          <span className="font-display font-semibold uppercase tracking-[-0.01em] text-[15px]">
            AutoCoach
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            Sign in
          </Link>
          <Button size="sm" asChild>
            <Link href="/signup">Start free</Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="md:hidden grid h-8 w-8 place-items-center border border-[var(--line-default)] text-[var(--fg-primary)]"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-[var(--line-subtle)] bg-[var(--bg-base)]">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-[var(--line-subtle)] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — Hero                                                           */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-28 pb-16 sm:pb-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 items-center">
          <div>
            <Reveal>
              <p className="kicker mb-6">01 / AutoCoach</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="font-display font-bold uppercase tracking-[-0.02em] leading-[0.98] text-[clamp(40px,7vw,84px)]">
                Read it once.
                <br />
                Remember it
                <br />
                for good.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.6] text-[var(--fg-secondary)]">
                AutoCoach turns any PDF or slide deck into an adaptive quiz engine. It
                extracts the concepts that matter, drills you where you&apos;re weak, and
                schedules reviews before you forget — so studying compounds instead of
                evaporating.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button size="xl" asChild>
                  <Link href="/signup">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <a href="#how">See how it works</a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
                <span className="text-[var(--accent-text)]">●</span> PDF + PPTX
                <span className="mx-2 text-[var(--fg-disabled)]">·</span>
                Adaptive engine
                <span className="mx-2 text-[var(--fg-disabled)]">·</span>
                Spaced review
                <span className="mx-2 text-[var(--fg-disabled)]">·</span>
                No card decks to build
              </p>
            </Reveal>
          </div>

          {/* Active quiz card vignette — the one hard-shadowed artifact */}
          <Reveal delay={0.15}>
            <div className="border-2 border-[var(--ink)] bg-[var(--bg-base)] shadow-hard p-5 sm:p-6 max-w-[440px] lg:ml-auto">
              <p className="kicker">Q.04/10 — B-Trees</p>
              <p className="mt-3 text-[16px] font-medium leading-snug">
                Which property keeps a B-tree balanced after insertions?
              </p>
              <div className="mt-4 divide-y divide-[var(--line-subtle)] border-t border-b border-[var(--line-subtle)]">
                {[
                  { label: "Binary search property", selected: false },
                  { label: "Heap property", selected: false },
                  { label: "All leaves at same depth", selected: true },
                  { label: "No duplicate keys", selected: false },
                ].map((opt) => (
                  <div
                    key={opt.label}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2.5 text-[13px]",
                      opt.selected
                        ? "text-[var(--fg-primary)] font-medium"
                        : "text-[var(--fg-secondary)]",
                    )}
                  >
                    {opt.selected && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)]" />
                    )}
                    <span
                      className={cn(
                        "h-3 w-3 rounded-full border shrink-0",
                        opt.selected
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--line-default)]",
                      )}
                    />
                    {opt.label}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--accent-text)]">
                  ● Correct +10 XP
                </span>
                <span className="font-mono text-[11px] text-[var(--fg-tertiary)]">
                  MASTERY 82%
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Problem (forgetting curve)                                     */
/* ------------------------------------------------------------------ */

function Problem() {
  return (
    <SectionShell id="problem" kicker="02 / The problem">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
        <div>
          <Reveal>
            <DisplayHeading>
              You forget 70% of what you read by tomorrow.
            </DisplayHeading>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-[var(--fg-secondary)]">
              Ebbinghaus measured it in 1885 and it hasn&apos;t changed: memory decays on a
              curve, fastest in the first 24 hours. Re-reading and highlighting feel
              productive but barely bend it. The only interventions that reliably work are
              <strong className="text-[var(--fg-primary)]"> active retrieval</strong> — being
              forced to recall — and{" "}
              <strong className="text-[var(--fg-primary)]">spaced repetition</strong> —
              recalling again right before you&apos;d forget.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.65] text-[var(--fg-secondary)]">
              AutoCoach builds both into the way you read. Every document becomes a
              question source; every wrong answer becomes a scheduled comeback.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <ForgettingCurve />
        </Reveal>
      </div>
    </SectionShell>
  );
}

function ForgettingCurve() {
  return (
    <figure className="m-0 border border-[var(--line-subtle)] bg-[var(--bg-base)] p-5">
      <figcaption className="kicker mb-4">Retention over 7 days</figcaption>
      <svg
        viewBox="0 0 440 220"
        className="w-full"
        role="img"
        aria-label="Forgetting curve: unaided memory decays to 25% while spaced retrieval keeps retention above 80%"
      >
        {/* axes */}
        <line x1="32" y1="12" x2="32" y2="188" stroke="var(--line-default)" strokeWidth="1" />
        <line x1="32" y1="188" x2="428" y2="188" stroke="var(--line-default)" strokeWidth="1" />
        {/* gridlines */}
        {[56, 100, 144].map((y) => (
          <line key={y} x1="32" y1={y} x2="428" y2={y} stroke="var(--line-subtle)" strokeWidth="1" />
        ))}
        {/* unaided decay */}
        <path
          d="M 32 20 C 90 110, 150 150, 240 165 C 310 175, 380 178, 428 180"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {/* with retrieval: sawtooth recoveries */}
        <path
          d="M 32 20 C 70 60, 95 80, 120 92 L 120 36 C 160 64, 190 76, 220 84 L 220 40 C 270 60, 310 68, 350 72 L 350 44 C 380 54, 410 58, 428 60"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        {/* intervention nodes */}
        {[
          { x: 120, y: 36 },
          { x: 220, y: 40 },
          { x: 350, y: 44 },
        ].map((p) => (
          <circle key={p.x} cx={p.x} cy={p.y} r="4" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1" />
        ))}
        {/* labels */}
        <text x="428" y="174" textAnchor="end" fontSize="10" fill="var(--fg-tertiary)" fontFamily="var(--font-mono)">
          UNAIDED — 25%
        </text>
        <text x="428" y="52" textAnchor="end" fontSize="10" fill="var(--accent-text)" fontFamily="var(--font-mono)">
          WITH AUTOCOACH — 84%
        </text>
        <text x="36" y="206" fontSize="10" fill="var(--fg-tertiary)" fontFamily="var(--font-mono)">
          DAY 0
        </text>
        <text x="428" y="206" textAnchor="end" fontSize="10" fill="var(--fg-tertiary)" fontFamily="var(--font-mono)">
          DAY 7
        </text>
      </svg>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — How it works                                                   */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Upload",
    body: "Drop a PDF or PPTX — lecture notes, a textbook chapter, a spec. AutoCoach extracts the text, chunks it, and indexes every passage for retrieval. Most documents are ready in under a minute.",
    icon: FileUp,
  },
  {
    n: "02",
    title: "Extract",
    body: "An LLM reads the document and pulls out the concepts worth knowing — not keywords, actual ideas. Each concept is linked back to the exact passages that teach it, so every question stays grounded in your source.",
    icon: Network,
  },
  {
    n: "03",
    title: "Drill",
    body: "Start a session. Questions are generated live against your weakest concepts — multiple choice, true/false, and free-text answers graded by AI. Answer, see why, move on. The next question is already waiting.",
    icon: Repeat,
  },
];

function HowItWorks() {
  return (
    <SectionShell id="how" kicker="03 / How it works">
      <Reveal>
        <DisplayHeading className="max-w-[24ch]">
          From document to drill in three steps.
        </DisplayHeading>
      </Reveal>
      <div className="mt-12 grid gap-px border border-[var(--line-subtle)] bg-[var(--line-subtle)] md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} delay={i * 0.08} className="bg-[var(--bg-base)]">
            <div className="p-6 sm:p-8 h-full">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[28px] tabular-nums text-[var(--fg-disabled)]">
                  {step.n}
                </span>
                <step.icon className="h-5 w-5 text-[var(--fg-tertiary)]" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 font-display font-semibold uppercase tracking-[-0.01em] text-[20px]">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.65] text-[var(--fg-secondary)]">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Feature deep-dives                                             */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    n: "01",
    title: "Concept extraction, not flashcard busywork",
    body: "You never write a card. AutoCoach reads your document and identifies the concepts that actually carry the material, ranks them by importance, and tags the core ones. Every quiz question traces back to a concept, and every concept traces back to the passage it came from.",
    vignette: (
      <div className="space-y-2">
        {[
          { c: "B-Trees", core: true },
          { c: "Write-ahead log", core: true },
          { c: "LSM compaction", core: false },
        ].map((row) => (
          <div
            key={row.c}
            className="flex items-center justify-between border-b border-[var(--line-subtle)] pb-2 text-[13px]"
          >
            <span>{row.c}</span>
            {row.core ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-[var(--accent)] text-[var(--accent-text)] px-1.5">
                Core
              </span>
            ) : (
              <Minus className="h-3 w-3 text-[var(--fg-disabled)]" />
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "02",
    title: "An engine that adapts every single question",
    body: "The selector watches your mastery per concept and aims each new question at the gap — weighted toward what you miss, with a recency window so sessions never loop the same idea twice in a row. Free-text answers are graded by an LLM that explains exactly what was missing from your answer.",
    vignette: (
      <div className="space-y-3 font-mono text-[11px] uppercase tracking-[0.08em]">
        <p className="text-[var(--fg-tertiary)]">Selector → weakest concept</p>
        <p className="text-[var(--fg-primary)]">Transactions · mastery 38%</p>
        <p className="text-[var(--accent-text)]">● Generating question…</p>
      </div>
    ),
  },
  {
    n: "03",
    title: "A review queue that knows when you'll forget",
    body: "Every concept you've touched gets a review date based on how well you know it. Open AutoCoach and the day's due reviews are waiting — five minutes of targeted recall instead of an hour of re-reading. Miss one and it comes back sooner; nail it and the interval stretches.",
    vignette: (
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between border-b border-[var(--line-subtle)] pb-2">
          <span>Due today</span>
          <span className="font-mono text-[var(--accent-text)]">7 concepts</span>
        </div>
        <div className="flex justify-between border-b border-[var(--line-subtle)] pb-2">
          <span>Tomorrow</span>
          <span className="font-mono text-[var(--fg-tertiary)]">3 concepts</span>
        </div>
        <div className="flex justify-between pb-1">
          <span>This week</span>
          <span className="font-mono text-[var(--fg-tertiary)]">12 concepts</span>
        </div>
      </div>
    ),
  },
  {
    n: "04",
    title: "Keyboard-first sessions, progress you can see",
    body: "Answer with 1–4, submit with Enter, next question with Space — sessions move at the speed you think. XP, streaks, and per-concept mastery bars make the invisible work of remembering visible, and the dashboard shows exactly which chapters are solid and which are theater.",
    vignette: (
      <div className="flex flex-wrap items-center gap-2">
        <Kbd>1</Kbd>
        <Kbd>2</Kbd>
        <Kbd>3</Kbd>
        <Kbd>4</Kbd>
        <span className="text-[var(--fg-disabled)] mx-1">·</span>
        <Kbd>↵</Kbd>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
          Submit
        </span>
      </div>
    ),
  },
];

function Features() {
  return (
    <SectionShell id="features" kicker="04 / Features">
      <Reveal>
        <DisplayHeading className="max-w-[22ch]">
          Built for remembering, not for collecting documents.
        </DisplayHeading>
      </Reveal>
      <div className="mt-12 divide-y divide-[var(--line-subtle)] border-t border-b border-[var(--line-subtle)]">
        {FEATURES.map((f, i) => (
          <Reveal key={f.n}>
            <div
              className={cn(
                "grid gap-6 py-10 md:grid-cols-[1fr_300px] md:gap-12 items-start",
                i % 2 === 1 && "md:grid-cols-[300px_1fr]",
              )}
            >
              <div className={cn(i % 2 === 1 && "md:order-2")}>
                <p className="kicker mb-3">{f.n} /</p>
                <h3 className="font-display font-semibold uppercase tracking-[-0.01em] text-[20px] leading-tight max-w-[28ch]">
                  {f.title}
                </h3>
                <p className="mt-3 max-w-[58ch] text-[14px] leading-[1.65] text-[var(--fg-secondary)]">
                  {f.body}
                </p>
              </div>
              <div
                className={cn(
                  "border border-[var(--line-subtle)] bg-[var(--bg-base)] p-4",
                  i % 2 === 1 && "md:order-1",
                )}
              >
                {f.vignette}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — The engine (mastery explainer)                                 */
/* ------------------------------------------------------------------ */

const MASTERY_ROWS = [
  { concept: "B-Trees", pct: 82 },
  { concept: "Indexes", pct: 74 },
  { concept: "Transactions", pct: 38 },
  { concept: "Replication", pct: 55 },
];

function Engine() {
  return (
    <SectionShell id="engine" kicker="05 / The engine">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
        <div>
          <Reveal>
            <DisplayHeading>Mastery is a number, and the engine chases it.</DisplayHeading>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-[var(--fg-secondary)]">
              Behind every session is a per-concept mastery score, updated after each
              answer. Correct on a hard free-text question moves it a lot; a lucky
              multiple-choice guess moves it a little. The selector always aims at your
              lowest scores, so time spent in AutoCoach goes where it pays the most.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="mt-6 space-y-2.5 text-[14px] text-[var(--fg-secondary)] list-none p-0">
              {[
                "Question difficulty adapts to your score per concept",
                "Wrong answers shorten the review interval automatically",
                "Overall mastery shows when you're genuinely exam-ready",
              ].map((li) => (
                <li key={li} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-text)]" />
                  {li}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="border border-[var(--line-subtle)] bg-[var(--bg-elev)] p-5 sm:p-6">
            <p className="kicker mb-5">Concept mastery</p>
            <div className="space-y-4">
              {MASTERY_ROWS.map((row) => (
                <div key={row.concept}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[13px]">{row.concept}</span>
                    <span className="font-mono text-[12px] tabular-nums">{row.pct}%</span>
                  </div>
                  <div className="h-[8px] border border-[var(--ink)] bg-[var(--bg-base)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-baseline justify-between border-t border-[var(--line-default)] pt-4">
              <span className="kicker">Overall mastery</span>
              <span className="font-mono text-[28px] tabular-nums leading-none">62%</span>
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — Pricing                                                        */
/* ------------------------------------------------------------------ */

const FREE_FEATURES = [
  "2 documents",
  "5 quiz sessions per day",
  "Concept extraction + mastery tracking",
  "Daily review queue",
];

const PRO_FEATURES = [
  "Unlimited documents",
  "Unlimited quiz sessions",
  "Free-text answers with AI grading",
  "Priority question generation",
  "Early access to new question types",
];

function Pricing() {
  const priceRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(priceRef, { once: true, margin: "-60px" });

  return (
    <SectionShell id="pricing" kicker="06 / Pricing">
      <Reveal>
        <DisplayHeading>Free to start. $8 when it sticks.</DisplayHeading>
      </Reveal>
      <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-[880px]">
        <Reveal>
          <div className="border border-[var(--line-subtle)] bg-[var(--bg-base)] p-6 sm:p-8 h-full flex flex-col">
            <p className="kicker">Free</p>
            <p className="mt-4 font-mono text-[44px] tabular-nums leading-none">
              $0
              <span className="text-[14px] text-[var(--fg-tertiary)]"> /forever</span>
            </p>
            <p className="mt-3 text-[13px] text-[var(--fg-secondary)]">
              Everything you need to find out it works.
            </p>
            <ul className="mt-6 space-y-2.5 text-[14px] text-[var(--fg-secondary)] flex-1 list-none p-0">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="font-mono text-[var(--fg-disabled)]">—</span>
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" block className="mt-8" asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="relative border-2 border-[var(--ink)] bg-[var(--bg-base)] p-6 sm:p-8 h-full flex flex-col">
            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)]" />
            <div className="flex items-center justify-between">
              <p className="kicker">Pro</p>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-[var(--accent)] text-[var(--accent-text)] px-1.5 py-px">
                Recommended
              </span>
            </div>
            <div ref={priceRef} className="relative mt-4 inline-block">
              <p className="font-mono text-[44px] tabular-nums leading-none">
                $8
                <span className="text-[14px] text-[var(--fg-tertiary)]"> /month</span>
              </p>
              <div
                className="pointer-events-none absolute inset-0 flex items-center"
                aria-hidden
              >
                <span className="inline-block w-[110%] -rotate-[10deg] origin-left">
                  <span
                    className={cn(
                      "block h-[2px] w-full bg-[var(--ink)]",
                      isInView && "anim-hairline-draw",
                    )}
                  />
                </span>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[var(--fg-secondary)]">
              For exam season, certification grinds, and people with more than three PDFs.
            </p>
            <ul className="mt-6 space-y-2.5 text-[14px] text-[var(--fg-secondary)] flex-1 list-none p-0">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-text)]" />
                  {f}
                </li>
              ))}
            </ul>
            <div
              role="status"
              className="mt-8 w-full border border-[var(--line-default)] px-1.5 py-2.5 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)] pointer-events-none select-none"
            >
              Coming soon
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 07 — FAQ                                                            */
/* ------------------------------------------------------------------ */

const FAQS = [
  {
    q: "What file types can I upload?",
    a: "PDF and PPTX today. Documents are chunked and indexed on upload; most are ready to quiz in under a minute. EPUB and DOCX are on the roadmap.",
  },
  {
    q: "How are questions generated?",
    a: "Questions are generated live by an LLM against the actual passages of your document — retrieved by semantic search, never from the model's general knowledge alone. That keeps questions specific to what you uploaded, including your professor's exact framing.",
  },
  {
    q: "How does the AI grade free-text answers?",
    a: "Your answer is compared against the source passage and an ideal answer. You get a verdict plus an explanation of what was missing or wrong — not just a score. Multiple choice and true/false are graded instantly.",
  },
  {
    q: "Is my data private?",
    a: "Your documents are stored in your account and used only to generate your questions. They're never shared with other users or used to train models. Delete a document and its content, chunks, and index entries are removed.",
  },
  {
    q: "What happens when I get something wrong?",
    a: "The concept's mastery score drops, the adaptive selector starts targeting it, and its review date moves closer. Wrong answers are the most useful signal in the system — they decide what you see next.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes. Cancel in settings and you keep Pro until the end of the billing period, then drop to the free tier. Your documents and mastery history stay intact.",
  },
];

function Faq() {
  return (
    <SectionShell id="faq" kicker="07 / FAQ">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <Reveal>
          <DisplayHeading>Questions, answered.</DisplayHeading>
        </Reveal>
        <Reveal delay={0.05}>
          <Accordion type="single" collapsible className="border-t border-[var(--line-subtle)]">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="border-b border-[var(--line-subtle)]"
              >
                <AccordionTrigger className="py-4 text-left text-[14px] font-medium hover:no-underline">
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-[var(--fg-disabled)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {f.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-[14px] leading-[1.65] text-[var(--fg-secondary)]">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — Final CTA + Footer                                             */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <SectionShell kicker="08 / Start">
      <div aria-hidden className="pointer-events-none absolute right-[4%] top-1/2 hidden -translate-y-1/2 opacity-[0.08] lg:block">
        <LogoGlyph size={320} />
      </div>
      <div className="relative py-6 sm:py-10">
        <Reveal>
          <h2 className="font-display font-bold uppercase tracking-[-0.02em] leading-[0.98] text-[clamp(36px,6.5vw,72px)] max-w-[16ch]">
            The next thing you read, keep.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="xl" asChild>
              <Link href="/signup">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
              No credit card · First quiz in 2 minutes
            </span>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-[var(--line-subtle)] bg-[var(--bg-base)]">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size={22} />
              <span className="font-display font-semibold uppercase tracking-[-0.01em]">
                AutoCoach
              </span>
            </div>
            <p className="mt-3 max-w-[40ch] text-[12px] leading-[1.6] text-[var(--fg-tertiary)]">
              Adaptive quizzes from your own documents. Read once, remember for good.
            </p>
          </div>
          <SignatureMotif width={110} className="hidden sm:block opacity-70" />
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-[var(--line-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--fg-disabled)]">
            © 2026 AutoCoach
          </p>
        </div>
      </div>
    </footer>
  );
}
