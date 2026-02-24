"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { BookOpen, Target, Clock, Sparkles, Loader2, Compass } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { analytics } from "@/lib/analytics";

const EXPERIENCE_LEVELS = [
    { id: "beginner", label: "Beginner", desc: "New to the topics I want to learn" },
    { id: "intermediate", label: "Intermediate", desc: "Have some foundational knowledge" },
    { id: "advanced", label: "Advanced", desc: "Looking for mastery & deep edge-cases" }
];

const WEEKLY_GOALS = [
    { id: 15, label: "15 min", desc: "Casual learning" },
    { id: 30, label: "30 min", desc: "Steady progress" },
    { id: 60, label: "60+ min", desc: "Intensive study" }
];

export function OnboardingModal() {
    const router = useRouter();
    const { onboarding, isLoading, submitting, completeOnboarding } = useOnboarding();
    const [isOpen, setIsOpen] = useState(false);

    // Form State
    const [step, setStep] = useState(1);
    const [learningGoal, setLearningGoal] = useState("");
    const [experienceLevel, setExperienceLevel] = useState("");
    const [weeklyMinutes, setWeeklyMinutes] = useState<number | null>(null);

    useEffect(() => {
        if (!isLoading && (!onboarding || !onboarding.has_completed)) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [onboarding, isLoading]);

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        if (!learningGoal || !experienceLevel || !weeklyMinutes) return;

        try {
            await completeOnboarding({
                goal: learningGoal,
                study_frequency: `${weeklyMinutes} minutes/day`,
                learning_topics: {
                    experience_level: experienceLevel,
                    weekly_target_minutes: weeklyMinutes,
                },
            });

            analytics.capture("onboarding_completed", {
                goal: learningGoal,
                experience_level: experienceLevel,
                weekly_target_minutes: weeklyMinutes
            });

            router.push("/upload");

            setIsOpen(false);
        } catch (err) {
            console.error("Failed to save onboarding:", err);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-xl bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-[var(--surface-border)] bg-[var(--surface-darker)]/50 flex flex-col gap-4">
                        <Logo />

                        {/* Progress Bar */}
                        <div className="w-full bg-[var(--surface-border)] h-1.5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-[var(--brand-primary)]"
                                initial={{ width: `${((step - 1) / 3) * 100}%` }}
                                animate={{ width: `${(step / 3) * 100}%` }}
                                transition={{ ease: "easeInOut" }}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 overflow-y-auto">
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="mb-8">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center mb-4 text-[var(--brand-primary)]">
                                            <Target size={24} />
                                        </div>
                                        <h2 className="text-2xl font-bold font-heading text-[var(--text-primary)]">What do you want to learn?</h2>
                                        <p className="text-[var(--text-secondary)] mt-2">
                                            Tell AutoCoach what you're focusing on so we can tailor the experience.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <textarea
                                            placeholder="e.g., I want to master systems design for my upcoming staff engineer interview..."
                                            className="w-full min-h-[120px] p-4 bg-[var(--surface-darker)] border border-[var(--surface-border)] focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] rounded-xl outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none"
                                            value={learningGoal}
                                            onChange={(e) => setLearningGoal(e.target.value)}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="mb-8">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--brand-secondary)]/10 flex items-center justify-center mb-4 text-[var(--brand-secondary)]">
                                            <Compass size={24} />
                                        </div>
                                        <h2 className="text-2xl font-bold font-heading text-[var(--text-primary)]">What's your current level?</h2>
                                        <p className="text-[var(--text-secondary)] mt-2">
                                            This helps us adjust the difficulty of your daily sprints.
                                        </p>
                                    </div>

                                    <div className="grid gap-3">
                                        {EXPERIENCE_LEVELS.map(level => (
                                            <button
                                                key={level.id}
                                                onClick={() => setExperienceLevel(level.id)}
                                                className={`text-left p-4 rounded-xl border flex flex-col gap-1 transition-all ${experienceLevel === level.id
                                                    ? "bg-[var(--brand-secondary)]/10 border-[var(--brand-secondary)] text-[var(--brand-secondary)]"
                                                    : "bg-[var(--surface-darker)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                                                    }`}
                                            >
                                                <span className={`font-semibold ${experienceLevel === level.id ? "text-[var(--brand-secondary)]" : "text-[var(--text-primary)]"}`}>
                                                    {level.label}
                                                </span>
                                                <span className="text-sm opacity-80">{level.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="mb-8">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--semantic-success)]/10 flex items-center justify-center mb-4 text-[var(--semantic-success)]">
                                            <Clock size={24} />
                                        </div>
                                        <h2 className="text-2xl font-bold font-heading text-[var(--text-primary)]">Set a weekly goal</h2>
                                        <p className="text-[var(--text-secondary)] mt-2">
                                            Consistency is key. How much time do you want to dedicate each week?
                                        </p>
                                    </div>

                                    <div className="grid gap-3">
                                        {WEEKLY_GOALS.map(goal => (
                                            <button
                                                key={goal.id}
                                                onClick={() => setWeeklyMinutes(goal.id)}
                                                className={`text-left p-4 rounded-xl border flex items-center justify-between transition-all ${weeklyMinutes === goal.id
                                                    ? "bg-[var(--semantic-success)]/10 border-[var(--semantic-success)] text-[var(--semantic-success)]"
                                                    : "bg-[var(--surface-darker)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                                                    }`}
                                            >
                                                <div>
                                                    <span className={`font-semibold block ${weeklyMinutes === goal.id ? "text-[var(--semantic-success)]" : "text-[var(--text-primary)]"}`}>
                                                        {goal.label} / day
                                                    </span>
                                                    <span className="text-sm opacity-80">{goal.desc}</span>
                                                </div>
                                                {weeklyMinutes === goal.id && <Sparkles size={18} />}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-[var(--surface-border)] bg-[var(--surface-darker)]/50 flex items-center justify-between mt-auto">
                        {step > 1 ? (
                            <Button variant="ghost" onClick={handleBack} disabled={submitting}>
                                Back
                            </Button>
                        ) : (
                            <div /> // Placeholder for styling
                        )}

                        {step < 3 ? (
                            <Button
                                onClick={handleNext}
                                disabled={
                                    (step === 1 && learningGoal.length < 5) ||
                                    (step === 2 && !experienceLevel)
                                }
                                className="ml-auto"
                            >
                                Continue
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                disabled={!weeklyMinutes || submitting}
                                className="ml-auto min-w-[120px]"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Learning"}
                            </Button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
