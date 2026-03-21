"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  staggerContainer,
  slideUpItem,
  cardHoverVariants,
} from "@/lib/motions";

interface StatsGridProps {
  totalDocuments: number;
  readyDocuments: number;
  processingDocuments: number;
  streak?: number;
}

interface StatConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  numeralClass?: string;
  getValue: (p: StatsGridProps) => number;
}

const stats: StatConfig[] = [
  {
    key: "total",
    label: "Total Docs",
    icon: BookOpen,
    iconBg: "bg-[var(--pop-coral)]/10",
    iconColor: "text-[var(--pop-coral)]",
    numeralClass: "text-stat-numeral coral",
    getValue: (p) => p.totalDocuments,
  },
  {
    key: "ready",
    label: "Ready to Study",
    icon: Sparkles,
    iconBg: "bg-[var(--pop-teal)]/10",
    iconColor: "text-[var(--pop-teal)]",
    numeralClass: "text-stat-numeral teal",
    getValue: (p) => p.readyDocuments,
  },
  {
    key: "processing",
    label: "Processing",
    icon: Clock,
    iconBg: "bg-[var(--pop-gold)]/10",
    iconColor: "text-[var(--pop-gold)]",
    numeralClass: "text-stat-numeral gold",
    getValue: (p) => p.processingDocuments,
  },
  {
    key: "streak",
    label: "Day Streak",
    icon: Flame,
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
    numeralClass: "text-stat-numeral",
    getValue: (p) => p.streak ?? 0,
  },
];

export function StatsGrid(props: StatsGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        const value = stat.getValue(props);
        return (
          <motion.div
            key={stat.key}
            variants={slideUpItem}
            initial="rest"
            whileHover="hover"
            animate="rest"
          >
            <motion.div variants={cardHoverVariants}>
              <div
                className={cn(
                  "relative p-5 rounded-2xl border border-[var(--surface-border)]",
                  "bg-[var(--surface-card)]/50 backdrop-blur-sm",
                  "transition-all duration-300 hover-lift card-glow",
                  "group overflow-hidden"
                )}
              >
                {/* Subtle gradient overlay on hover */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    "bg-gradient-to-br from-[var(--pop-coral)]/5 via-transparent to-[var(--pop-gold)]/5"
                  )}
                />

                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                      stat.iconBg
                    )}
                  >
                    <Icon size={20} className={stat.iconColor} />
                  </div>

                  {/* Animated Number */}
                  <div className="mb-2">
                    <span className={cn(stat.numeralClass)}>
                      <AnimatedNumber value={value} stiffness={100} damping={20} />
                    </span>
                  </div>

                  {/* Label */}
                  <p className="text-sm text-[var(--text-muted)] uppercase tracking-wider font-medium">
                    {stat.label}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
