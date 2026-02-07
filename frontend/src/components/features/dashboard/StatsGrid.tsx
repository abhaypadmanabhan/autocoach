"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  staggerContainer,
  slideUpItem,
  cardHoverVariants,
} from "@/lib/motions";

interface StatsGridProps {
  totalDocuments: number;
  readyDocuments: number;
  processingDocuments: number;
}

const stats = [
  {
    key: "total",
    label: "Documents",
    icon: BookOpen,
    iconBg: "bg-brand-primary/10",
    iconColor: "text-brand-primary",
    getValue: (p: StatsGridProps) => p.totalDocuments,
  },
  {
    key: "ready",
    label: "Ready",
    icon: Sparkles,
    iconBg: "bg-semantic-success/10",
    iconColor: "text-semantic-success",
    getValue: (p: StatsGridProps) => p.readyDocuments,
  },
  {
    key: "processing",
    label: "Processing",
    icon: Clock,
    iconBg: "bg-brand-secondary/10",
    iconColor: "text-brand-secondary",
    getValue: (p: StatsGridProps) => p.processingDocuments,
  },
] as const;

export function StatsGrid(props: StatsGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.key}
            variants={slideUpItem}
            initial="rest"
            whileHover="hover"
            animate="rest"
          >
            <motion.div variants={cardHoverVariants}>
              <Card
                className={cn(
                  "border-surface-border bg-surface-card",
                  "rounded-2xl"
                )}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        stat.iconBg,
                        stat.iconColor
                      )}
                    >
                      <Icon size={24} />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-text-primary">
                        {stat.getValue(props)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-muted uppercase tracking-wider">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
