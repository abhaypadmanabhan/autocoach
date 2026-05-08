"use client";

import { Concept } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight, Star, Lightbulb } from "lucide-react";
import Link from "next/link";

interface ConceptListProps {
    documentId: string;
    concepts: Concept[];
}

export function ConceptList({ documentId, concepts }: ConceptListProps) {
    // Sort concepts: core first, then by importance
    const sortedConcepts = [...concepts].sort((a, b) => {
        if (a.is_core && !b.is_core) return -1;
        if (!a.is_core && b.is_core) return 1;
        return b.importance_score - a.importance_score;
    });

    if (concepts.length === 0) {
        return (
            <div className="text-center py-12 px-6 bg-surface-card border border-surface-border/50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lightbulb size={28} className="text-brand-primary" />
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">
                    No concepts yet
                </h3>
                <p className="text-text-muted text-sm max-w-md mx-auto mb-4">
                    This document is still being processed or no concepts were detected. 
                    Check back soon or try uploading a different document.
                </p>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()}
                >
                    Retry Loading
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-medium text-text-primary flex items-center gap-2">
                Learning Concepts
                <span className="text-sm font-normal text-text-muted bg-surface-card px-2 py-0.5 rounded-full">
                    {concepts.length}
                </span>
            </h2>

            <div className="bg-surface-card border border-surface-border/50 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-surface-border/50 bg-surface-darker/30 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    <div className="col-span-6 md:col-span-5">Concept Name</div>
                    <div className="col-span-3 md:col-span-2 text-center">Importance</div>
                    <div className="col-span-3 md:col-span-3">Mastery</div>
                    <div className="col-span-12 md:col-span-2 text-right hidden md:block">Action</div>
                </div>

                <div className="divide-y divide-surface-border/30">
                    {sortedConcepts.map((concept) => (
                        <motion.div
                            key={concept.id}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-darker/20 transition-colors group"
                        >
                            <div className="col-span-6 md:col-span-5 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-text-primary">{concept.concept_name}</span>
                                    {concept.is_core && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border-none">
                                                        CORE
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>Core concept essential for understanding</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                                {concept.concept_description && (
                                    <p className="text-xs text-text-muted line-clamp-1">{concept.concept_description}</p>
                                )}
                            </div>

                            <div className="col-span-3 md:col-span-2 flex justify-center">
                                <div className="flex gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={12}
                                            className={cn(
                                                i < Math.round((concept.importance_score || 0) / 2)
                                                    ? "text-semantic-warning fill-semantic-warning"
                                                    : "text-surface-border"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="col-span-3 md:col-span-3">
                                <div className="flex items-center gap-3">
                                    <Progress value={concept.mastery_score || 0} className="h-1.5 bg-surface-border" />
                                    <span className="text-xs font-medium text-text-secondary w-8 text-right">
                                        {concept.mastery_score || 0}%
                                    </span>
                                </div>
                            </div>

                            <div className="col-span-12 md:col-span-2 flex justify-end">
                                <Link href={`/dashboard?docId=${documentId}`}>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs hover:text-brand-primary hover:bg-brand-primary/10">
                                        Quiz Concept <ChevronRight size={14} className="ml-1 opacity-50" />
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
