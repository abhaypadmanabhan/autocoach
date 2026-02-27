/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { useDailySprint } from "@/hooks/useDailySprint";
import { analytics } from "@/lib/analytics";

interface ActivationBannerProps {
  documentId: string;
  sessionId?: string;
}

const STORAGE_KEY = (id: string) => `activation_cta_shown_${id}`;

export function ActivationBanner({ documentId, sessionId }: ActivationBannerProps) {
  const router = useRouter();
  const { startSprintWithFallback } = useDailySprint();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = STORAGE_KEY(documentId);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    analytics.capture("activation_cta_shown", { document_id: documentId, session_id: sessionId });
    setReady(true);
  }, [documentId, sessionId]);

  const handleStartSprint = async () => {
    analytics.capture("activation_cta_clicked", { document_id: documentId, session_id: sessionId });
    try {
      const result = await startSprintWithFallback();
      if (result.sessionId) {
        router.push(`/daily-sprint/${result.sessionId}`);
      }
    } catch {
      // Silent fail - user can still use existing redirect
    }
  };

  if (!ready) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-4 bg-surface-card border border-surface-border px-6 py-4 rounded-2xl shadow-lg">
          <Rocket className="text-brand-primary" size={24} />
          <p className="text-text-primary font-medium">Your first sprint is ready</p>
          <button
            onClick={handleStartSprint}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-colors"
          >
            Start Sprint
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
