"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileUp,
  Brain,
  Sparkles,
  Trophy,
  Zap,
  Star,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/primitives-acx/BrandMark";
import { Kbd } from "@/components/primitives-acx/Kbd";
import { LivePill } from "@/components/primitives-acx/LivePill";
import { ThemeToggle } from "@/components/primitives-acx/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--fg-primary)]">
      <Nav />
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <Voices />
      <Pricing />
      <Faq />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--bg-base)_86%,transparent)] backdrop-blur">
      <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between h-full">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-mono text-[12.5px] tracking-[0.04em] font-medium">
            AUTOCOACH
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild className="!bg-[var(--fg-primary)] !text-[var(--bg-base)] hover:!bg-[var(--fg-secondary)]">
            <Link href="/signup">
              Get started
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-6 py-16 sm:py-24 lg:py-28">
      <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-center">
        <div>
          <LivePill className="mb-7">Adaptive · Now in beta</LivePill>
          <h1 className="text-[40px] sm:text-[48px] lg:text-[56px] font-medium tracking-[-0.038em] leading-[1.04] text-balance text-[var(--fg-primary)]">
            Drop a document.{" "}
            <em className="not-italic font-normal text-[var(--fg-tertiary)]">
              Beat the curve.
            </em>
          </h1>
          <p className="mt-5 text-[16px] leading-[1.55] text-[var(--fg-secondary)] max-w-[460px]">
            AutoCoach turns your PDFs and slides into adaptive quizzes. Spaced
            repetition keeps every concept in your head — no flashcards required.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="!bg-[var(--fg-primary)] !text-[var(--bg-base)] hover:!bg-[var(--fg-secondary)] !h-[42px] !px-[18px] !text-[14px]"
            >
              <Link href="/signup">
                Start free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a href="#how">
                See how it works
                <Kbd className="ml-1">↓</Kbd>
              </a>
            </Button>
          </div>
          <div className="mt-7 flex items-center gap-4 font-mono text-[11px] tracking-[0.06em] text-[var(--fg-tertiary)]">
            <span className="inline-flex gap-0.5 text-[var(--warning)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-2.5 w-2.5 fill-current" />
              ))}
            </span>
            <span className="text-[var(--fg-disabled)]">·</span>
            <span>2,400+ learners</span>
            <span className="text-[var(--fg-disabled)]">·</span>
            <span>No credit card</span>
          </div>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTab((t) => ((t + 1) % 3) as 0 | 1 | 2);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative aspect-[4/3.1] rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 overflow-hidden"
      aria-hidden
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-[180ms]",
                i === tab
                  ? "w-4 bg-[var(--accent)]"
                  : "w-1.5 bg-[var(--line-strong)]",
              )}
            />
          ))}
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
          {tab === 0 ? "Quiz" : tab === 1 ? "Free response" : "Result"}
        </span>
      </div>
      <div className="h-px bg-[var(--bg-elev)] mb-5 flex gap-1">
        <div
          className="h-px bg-[var(--accent)] transition-[width] duration-[240ms]"
          style={{ width: `${(tab + 1) * 33}%` }}
        />
      </div>
      <div className="relative min-h-[260px]">
        {tab === 0 && <PreviewMcq />}
        {tab === 1 && <PreviewFree />}
        {tab === 2 && <PreviewResult />}
      </div>
    </div>
  );
}

function PreviewMcq() {
  return (
    <div className="anim-step-in">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--fg-tertiary)] mb-3">
        Question 03 — Distributed systems
      </div>
      <p className="text-[17px] font-medium leading-[1.35] tracking-[-0.012em] text-[var(--fg-primary)] mb-4 text-balance">
        Which consistency model permits replicas to diverge temporarily?
      </p>
      <div className="-mx-2">
        {[
          { letter: "A", text: "Linearizability", state: "" },
          { letter: "B", text: "Sequential consistency", state: "" },
          { letter: "C", text: "Eventual consistency", state: "correct" },
          { letter: "D", text: "Strict serializable", state: "selected" },
        ].map((o) => (
          <div
            key={o.letter}
            className={cn(
              "relative flex items-center gap-3 px-4 py-2.5",
              "border-t border-[var(--line-subtle)] last:border-b",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-0 bottom-0 w-0.5",
                o.state === "correct" && "bg-[var(--success)]",
                o.state === "selected" && "bg-[var(--accent)]",
              )}
            />
            <span
              className={cn(
                "font-mono text-[11px] w-4",
                o.state === "correct"
                  ? "text-[var(--success)]"
                  : o.state === "selected"
                    ? "text-[var(--accent)]"
                    : "text-[var(--fg-tertiary)]",
              )}
            >
              {o.letter}
            </span>
            <span
              className={cn(
                "text-[13px] flex-1",
                o.state === "correct" || o.state === "selected"
                  ? "text-[var(--fg-primary)]"
                  : "text-[var(--fg-secondary)]",
              )}
            >
              {o.text}
            </span>
            {o.state === "correct" && (
              <Check className="h-3.5 w-3.5 text-[var(--success)]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewFree() {
  return (
    <div className="anim-step-in">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--fg-tertiary)] mb-3">
        Question 04 — Free response
      </div>
      <p className="text-[17px] font-medium leading-[1.35] tracking-[-0.012em] text-[var(--fg-primary)] mb-4">
        In your own words, why does Raft elect a leader?
      </p>
      <div className="rounded-md border border-[var(--line-default)] bg-[var(--bg-base)] p-3 min-h-[100px] text-[13px] leading-[1.55] text-[var(--fg-secondary)] mb-3">
        Raft elects a leader to serialize log appends — only the leader accepts
        writes, simplifying consensus and ensuring a single source
        <span className="text-[var(--accent)]">▏</span>
      </div>
      <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
        <span>cmd + ↵ submit</span>
        <span className="tabular-nums">123 chars</span>
      </div>
    </div>
  );
}

function PreviewResult() {
  return (
    <div className="anim-step-in flex flex-col items-center pt-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--fg-tertiary)] mb-2">
        Score
      </span>
      <div className="font-mono text-[44px] tabular-nums text-[var(--success)] tracking-[-0.04em] leading-none mb-2">
        87%
      </div>
      <Badge variant="success">Strong</Badge>
      <div className="mt-5 grid grid-cols-3 gap-px bg-[var(--line-subtle)] border border-[var(--line-subtle)] rounded-md overflow-hidden w-full max-w-[320px]">
        {[
          { l: "Correct", v: "13" },
          { l: "Wrong", v: "2" },
          { l: "XP", v: "+130" },
        ].map((s) => (
          <div key={s.l} className="bg-[var(--bg-surface)] px-3 py-2.5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
              {s.l}
            </p>
            <p className="font-mono text-[14px] tabular-nums text-[var(--fg-primary)] mt-0.5">
              {s.v}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Problem() {
  return (
    <section className="border-t border-[var(--line-subtle)] py-24 sm:py-32 px-6">
      <div className="max-w-[1280px] mx-auto grid lg:grid-cols-[0.8fr_1.1fr] gap-12 lg:gap-20 items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--fg-tertiary)] mb-7 inline-flex items-center gap-2.5">
            <span className="inline-block w-3.5 h-0.5 bg-[var(--accent)]" />
            The forgetting curve
          </p>
          <h2 className="text-[32px] sm:text-[40px] font-medium tracking-[-0.028em] leading-[1.12] text-balance">
            You forget{" "}
            <span className="font-mono text-[var(--accent)] tracking-[-0.02em]">70%</span>{" "}
            of what you read in 24 hours.
          </h2>
          <p className="mt-5 text-[15px] leading-[1.65] text-[var(--fg-secondary)] max-w-[460px]">
            Reading is recognition, not retrieval. Without active recall, your brain
            never forms the durable trace needed to remember a concept past tomorrow.
          </p>
          <div className="mt-7 inline-flex items-center gap-3 px-4 py-3 rounded-md border border-[var(--line-default)] bg-[var(--bg-surface)]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--fg-tertiary)] shrink-0">
              Pivot
            </span>
            <p className="text-[13px] text-[var(--fg-primary)]">
              Adaptive quizzes flip recognition into retrieval — the only known way
              to flatten the curve.
            </p>
          </div>
        </div>
        <ForgettingCurve />
      </div>
    </section>
  );
}

function ForgettingCurve() {
  return (
    <div className="rounded-lg border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8">
      <div className="grid grid-cols-[42px_1fr] gap-3.5 h-[280px] sm:h-[320px]">
        <div className="flex flex-col justify-between font-mono text-[10px] text-[var(--fg-tertiary)]">
          {["100%", "75%", "50%", "25%", "0%"].map((y) => (
            <span key={y}>{y}</span>
          ))}
        </div>
        <div className="relative">
          {[0, 25, 50, 75, 100].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 h-px bg-[var(--line-subtle)]"
              style={{ top: `${pct}%` }}
            />
          ))}
          <svg
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <path
              d="M 0 10 C 80 100 160 150 400 175"
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d="M 0 10 C 60 30 120 35 180 30 C 240 25 300 22 400 18"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            {[
              { x: 50, label: "1d" },
              { x: 130, label: "3d" },
              { x: 230, label: "1w" },
              { x: 340, label: "30d" },
            ].map((p) => (
              <g key={p.label}>
                <circle cx={p.x} cy={20} r="3" className="fill-[var(--accent)]" />
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-[var(--line-subtle)]">
        <Legend dotClass="bg-[var(--line-strong)]" label="Without practice" />
        <Legend dotClass="bg-[var(--accent)]" label="With AutoCoach" />
      </div>
    </div>
  );
}

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
      <span className={cn("h-0.5 w-4", dotClass)} />
      {label}
    </div>
  );
}

const FEATURES = [
  {
    icon: Brain,
    title: "Concept extraction",
    desc: "We surface every core idea in your document — no rote summarization.",
  },
  {
    icon: Sparkles,
    title: "Adaptive sessions",
    desc: "Difficulty scales to your mastery, focusing time where it matters most.",
  },
  {
    icon: Zap,
    title: "Spaced retrieval",
    desc: "Items reappear at the right interval to commit them to long-term memory.",
  },
  {
    icon: Trophy,
    title: "Progress that lasts",
    desc: "Per-concept mastery tracking, not vanity scores.",
  },
];

function Features() {
  return (
    <section
      id="features"
      className="border-t border-[var(--line-subtle)] py-24 sm:py-28 px-6"
    >
      <div className="max-w-[1280px] mx-auto">
        <SectionHead
          eyebrow="Capabilities"
          title="Built for retention."
          accent="Not for reading."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-5 transition-colors duration-[180ms] hover:border-[var(--line-default)] hover:bg-[var(--bg-surface)]"
            >
              <div className="grid place-items-center h-9 w-9 rounded-md bg-[var(--bg-elev)] border border-[var(--line-default)] mb-4">
                <f.icon className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <h3 className="text-[15px] font-medium text-[var(--fg-primary)] mb-1.5">
                {f.title}
              </h3>
              <p className="text-[13px] leading-[1.55] text-[var(--fg-secondary)]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: FileUp,
      title: "Drop a PDF or slides",
      desc: "Upload up to 50MB. We handle text, images, and tables.",
    },
    {
      n: "02",
      icon: Brain,
      title: "We extract concepts",
      desc: "Core ideas surface in seconds, ranked by importance.",
    },
    {
      n: "03",
      icon: Trophy,
      title: "You learn by retrieval",
      desc: "Adaptive sessions, spaced reviews, real mastery.",
    },
  ];

  return (
    <section
      id="how"
      className="border-t border-[var(--line-subtle)] py-24 sm:py-28 px-6"
    >
      <div className="max-w-[1280px] mx-auto">
        <SectionHead
          eyebrow="How it works"
          title="Three steps."
          accent="About two minutes."
        />
        <ol className="grid lg:grid-cols-3 gap-px mt-12 bg-[var(--line-subtle)] border border-[var(--line-subtle)] rounded-md overflow-hidden">
          {steps.map((s) => (
            <li
              key={s.n}
              className="bg-[var(--bg-base)] p-7 sm:p-9 flex flex-col"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)] mb-5">
                Step {s.n}
              </span>
              <s.icon className="h-5 w-5 text-[var(--accent)] mb-4" />
              <h3 className="text-[20px] font-medium text-[var(--fg-primary)] tracking-[-0.01em] mb-2">
                {s.title}
              </h3>
              <p className="text-[14px] text-[var(--fg-secondary)] leading-[1.55]">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const VOICES = [
  {
    quote: "I went from re-reading PDFs to actually retrieving them. Hit 90%+ on the section that destroyed me last cycle.",
    name: "Sarah Chen",
    role: "Med student · USMLE Step 1",
  },
  {
    quote: "The CORE tag is killer. I stopped studying minutiae and started studying the arteries.",
    name: "Daniel Kim",
    role: "Bar exam candidate",
  },
  {
    quote: "I run AutoCoach on every system design paper now. Concepts stick like flashcards never did.",
    name: "Priya Nair",
    role: "Staff engineer prep",
  },
];

function Voices() {
  return (
    <section className="border-t border-[var(--line-subtle)] py-24 sm:py-28 px-6">
      <div className="max-w-[1280px] mx-auto">
        <SectionHead
          eyebrow="Voices"
          title="From the people fighting"
          accent="their own material."
        />
        <div className="grid lg:grid-cols-3 gap-3 mt-12">
          {VOICES.map((v) => (
            <figure
              key={v.name}
              className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-6 flex flex-col"
            >
              <div className="inline-flex gap-0.5 mb-4 text-[var(--warning)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-current" />
                ))}
              </div>
              <blockquote className="flex-1 text-[14px] leading-[1.6] text-[var(--fg-primary)]">
                {v.quote}
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-[var(--line-subtle)]">
                <p className="text-[13px] font-medium text-[var(--fg-primary)]">
                  {v.name}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)] mt-0.5">
                  {v.role}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    highlight: false,
    cta: "Start free",
    href: "/signup",
    features: [
      "5 documents per month",
      "Adaptive sessions",
      "Spaced review",
      "Concept dashboard",
    ],
  },
  {
    name: "Pro",
    price: "$8",
    cadence: "per month",
    highlight: true,
    cta: "Upgrade later",
    href: "/signup",
    features: [
      "Unlimited documents",
      "Free response with AI eval",
      "Advanced concept tagging",
      "Priority extraction queue",
      "Export sessions",
    ],
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="border-t border-[var(--line-subtle)] py-24 sm:py-28 px-6"
    >
      <div className="max-w-[1280px] mx-auto">
        <SectionHead
          eyebrow="Pricing"
          title="Free to start."
          accent="Pro when you're serious."
        />
        <div className="grid sm:grid-cols-2 gap-4 mt-12 max-w-[840px]">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={cn(
                "rounded-md border p-7 flex flex-col gap-5",
                p.highlight
                  ? "border-[var(--accent-line)] bg-[var(--accent-fade)]"
                  : "border-[var(--line-subtle)] bg-[var(--bg-base)]",
              )}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-[18px] font-medium text-[var(--fg-primary)]">
                  {p.name}
                </h3>
                {p.highlight && <Badge variant="accent">Recommended</Badge>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[40px] tabular-nums tracking-[-0.03em] text-[var(--fg-primary)]">
                  {p.price}
                </span>
                <span className="text-[13px] text-[var(--fg-tertiary)]">
                  {p.cadence}
                </span>
              </div>
              <ul className="space-y-2.5">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[13px] text-[var(--fg-secondary)]"
                  >
                    <Check className="h-3.5 w-3.5 mt-0.5 text-[var(--accent)] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={p.highlight ? "default" : "secondary"}
                size="lg"
                block
              >
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "How long does extraction take?",
    a: "Most documents under 50 pages are ready in 30-60 seconds. Larger docs queue and process in parallel.",
  },
  {
    q: "What file types do you support?",
    a: "PDF and PowerPoint (.pptx) today. Markdown and EPUB are on the roadmap.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Documents are encrypted at rest. We don't train on your content. You can delete a document and all derived sessions at any time.",
  },
  {
    q: "Can I export my sessions?",
    a: "Pro users can export sessions and per-concept mastery data as CSV or JSON.",
  },
];

function Faq() {
  return (
    <section
      id="faq"
      className="border-t border-[var(--line-subtle)] py-24 sm:py-28 px-6"
    >
      <div className="max-w-[1280px] mx-auto">
        <SectionHead eyebrow="FAQ" title="Common questions." />
        <div className="mt-12 max-w-[720px]">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--line-subtle)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left transition-colors hover:text-[var(--fg-primary)]"
      >
        <span className="text-[15px] font-medium text-[var(--fg-primary)]">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--fg-tertiary)] transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <p className="pb-5 text-[14px] leading-[1.65] text-[var(--fg-secondary)] anim-step-in">
          {a}
        </p>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="border-t border-[var(--line-subtle)] py-24 sm:py-32 px-6">
      <div className="max-w-[820px] mx-auto text-center">
        <h2 className="text-[36px] sm:text-[44px] font-medium tracking-[-0.028em] leading-[1.12] text-balance">
          Stop reading.{" "}
          <em className="not-italic font-normal text-[var(--fg-tertiary)]">
            Start retrieving.
          </em>
        </h2>
        <p className="mt-4 text-[15px] text-[var(--fg-secondary)] max-w-[480px] mx-auto">
          Free forever. No credit card. Drop your first document in 30 seconds.
        </p>
        <Button
          asChild
          className="mt-8 !bg-[var(--fg-primary)] !text-[var(--bg-base)] hover:!bg-[var(--fg-secondary)] !h-12 !px-6 !text-[14px]"
        >
          <Link href="/signup">
            Start free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  accent,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between flex-wrap gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--fg-tertiary)] mb-3">
          {eyebrow}
        </p>
        <h2 className="text-[32px] sm:text-[36px] font-medium tracking-[-0.028em] leading-[1.18] text-balance max-w-[720px]">
          {title}{" "}
          {accent && (
            <em className="not-italic font-normal text-[var(--fg-tertiary)]">
              {accent}
            </em>
          )}
        </h2>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--line-subtle)] px-6 py-12">
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-mono text-[12.5px] tracking-[0.04em] font-medium">
            AUTOCOACH
          </span>
        </div>
        <div className="flex items-center gap-3 text-[var(--fg-tertiary)]">
          <a
            href="#"
            aria-label="Twitter"
            className="hover:text-[var(--fg-primary)] transition-colors"
          >
            <Twitter className="h-3.5 w-3.5" />
          </a>
          <a
            href="#"
            aria-label="LinkedIn"
            className="hover:text-[var(--fg-primary)] transition-colors"
          >
            <Linkedin className="h-3.5 w-3.5" />
          </a>
          <a
            href="#"
            aria-label="GitHub"
            className="hover:text-[var(--fg-primary)] transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
          © 2026 AutoCoach
        </p>
      </div>
    </footer>
  );
}
