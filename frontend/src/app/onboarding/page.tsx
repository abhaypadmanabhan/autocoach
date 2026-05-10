"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";

import { useOnboarding } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/primitives-acx/BrandMark";
import { ThemeToggle } from "@/components/primitives-acx/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";
import { analytics } from "@/lib/analytics";
import { createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const EXPERIENCE_LEVELS = [
  { id: "beginner", label: "Beginner", desc: "New to the topics I want to learn" },
  { id: "intermediate", label: "Intermediate", desc: "Have some foundational knowledge" },
  { id: "advanced", label: "Advanced", desc: "Looking for mastery & deep edge cases" },
] as const;

const TIME_COMMITMENTS = [
  { id: 15, label: "15 min", desc: "Casual learning" },
  { id: 30, label: "30 min", desc: "Steady progress" },
  { id: 60, label: "60+ min", desc: "Intensive study" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { onboarding, isLoading, submitting, completeOnboarding } = useOnboarding();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced" | "">("");
  const [minutes, setMinutes] = useState<15 | 30 | 60 | null>(null);

  useEffect(() => {
    if (!isLoading && onboarding?.has_completed) {
      router.replace("/dashboard");
    }
  }, [isLoading, onboarding, router]);

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const submit = async () => {
    if (!goal || !level || !minutes) return;
    try {
      await completeOnboarding({
        goal,
        study_frequency: `${minutes} minutes/day`,
        experience_level: level,
        learning_topics: { experience_level: level, weekly_target_minutes: minutes },
      });
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) analytics.identify(user.id, { experience_level: level });
      analytics.capture("onboarding_completed", {
        goal,
        experience_level: level,
        weekly_target_minutes: minutes,
      });
      router.push("/upload");
    } catch (err) {
      console.error("Failed to save onboarding:", err);
    }
  };

  const canAdvance =
    (step === 1 && goal.trim().length >= 5) ||
    (step === 2 && level !== "") ||
    (step === 3 && minutes !== null);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg-base)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-tertiary)]" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
        <header className="flex items-center h-14 px-6 border-b border-[var(--line-subtle)]">
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="font-semibold tracking-[-0.01em] text-[var(--fg-primary)]">
              AutoCoach
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
              Step {step} / 3
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="px-6 pt-6">
          <div className="max-w-[680px] mx-auto">
            <div className="relative h-px bg-[var(--line-subtle)]">
              <div
                className="absolute left-0 top-0 h-full bg-[var(--accent)] transition-[width] duration-[320ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <main className="flex-1 px-6 py-12">
          <div className="max-w-[680px] mx-auto">
            <div key={step} className="anim-step-in">
              {step === 1 && (
                <section className="space-y-6">
                  <header>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
                      01 — Goal
                    </span>
                    <h1 className="mt-2 text-[28px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
                      What do you want to learn?
                    </h1>
                    <p className="mt-2 text-[15px] text-[var(--fg-secondary)]">
                      Tell AutoCoach what you&apos;re focusing on so we can tailor question difficulty,
                      review cadence, and sessions to it.
                    </p>
                  </header>
                  <div className="space-y-2">
                    <Label htmlFor="goal" variant="mono">
                      Goal
                    </Label>
                    <Textarea
                      id="goal"
                      autoFocus
                      placeholder="e.g., Master systems design for my upcoming staff engineer interview"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canAdvance) {
                          e.preventDefault();
                          next();
                        }
                      }}
                      className="min-h-32"
                    />
                    <div className="flex items-center justify-between text-[12px] text-[var(--fg-tertiary)]">
                      <span>At least 5 characters</span>
                      <span className="font-mono tabular-nums">{goal.length}</span>
                    </div>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="space-y-6">
                  <header>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
                      02 — Level
                    </span>
                    <h1 className="mt-2 text-[28px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
                      What&apos;s your current level?
                    </h1>
                    <p className="mt-2 text-[15px] text-[var(--fg-secondary)]">
                      We&apos;ll calibrate question difficulty against this baseline.
                    </p>
                  </header>
                  <div className="grid gap-2">
                    {EXPERIENCE_LEVELS.map((opt) => {
                      const active = level === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLevel(opt.id)}
                          className={cn(
                            "text-left p-4 rounded-md border bg-[var(--bg-base)]",
                            "transition-[border-color,background-color] duration-[180ms]",
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-fade)]"
                              : "border-[var(--line-default)] hover:border-[var(--line-strong)] hover:bg-[var(--bg-elev)]",
                          )}
                        >
                          <span
                            className={cn(
                              "block font-medium text-[14px]",
                              active ? "text-[var(--accent)]" : "text-[var(--fg-primary)]",
                            )}
                          >
                            {opt.label}
                          </span>
                          <span className="block text-[13px] text-[var(--fg-secondary)] mt-0.5">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-6">
                  <header>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
                      03 — Cadence
                    </span>
                    <h1 className="mt-2 text-[28px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
                      How much time per day?
                    </h1>
                    <p className="mt-2 text-[15px] text-[var(--fg-secondary)]">
                      Daily review queue size is sized to fit this commitment.
                    </p>
                  </header>
                  <div className="grid gap-2">
                    {TIME_COMMITMENTS.map((opt) => {
                      const active = minutes === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setMinutes(opt.id as 15 | 30 | 60)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-md border bg-[var(--bg-base)]",
                            "transition-[border-color,background-color] duration-[180ms]",
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-fade)]"
                              : "border-[var(--line-default)] hover:border-[var(--line-strong)] hover:bg-[var(--bg-elev)]",
                          )}
                        >
                          <div className="text-left">
                            <span
                              className={cn(
                                "block font-medium text-[14px]",
                                active ? "text-[var(--accent)]" : "text-[var(--fg-primary)]",
                              )}
                            >
                              {opt.label} / day
                            </span>
                            <span className="block text-[13px] text-[var(--fg-secondary)] mt-0.5">
                              {opt.desc}
                            </span>
                          </div>
                          <span className="font-mono text-[12px] text-[var(--fg-tertiary)] tabular-nums">
                            {opt.id} min
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-[var(--line-subtle)] px-6 py-4">
          <div className="max-w-[680px] mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === 1 || submitting}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={!canAdvance}>
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!canAdvance || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    Start learning
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
