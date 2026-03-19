/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useDailySprint } from "@/hooks/useDailySprint";
import { analytics } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/primitives/Modal";

interface ActivationBannerProps {
  documentId: string;
  sessionId?: string;
  precreatedSessionId?: string | null;
  precreateLoading?: boolean;
}

const STORAGE_KEY = (id: string) => `activation_cta_shown_${id}`;

export function ActivationBanner({ documentId, sessionId, precreatedSessionId, precreateLoading }: ActivationBannerProps) {
  const router = useRouter();
  const { startSprintWithFallback } = useDailySprint();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = STORAGE_KEY(documentId);
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    analytics.capture("activation_cta_shown", { document_id: documentId, session_id: sessionId });
    setOpen(true);
  }, [documentId, sessionId]);

  const handleStartSprint = async () => {
    analytics.capture("activation_cta_clicked", {
      document_id: documentId,
      session_id: precreatedSessionId ?? sessionId,
    });

    // Fast path: session was pre-created in background
    if (precreatedSessionId) {
      analytics.capture("quiz_session_started", {
        session_id: precreatedSessionId,
        document_id: documentId,
        mode: "sprint",
        source: "pre_created",
        wait_ms: 0,
      });
      router.push(`/daily-sprint/${precreatedSessionId}?doc=${documentId}`);
      return;
    }

    // Slow path: create session on click (existing behavior)
    setLoading(true);
    try {
      const result = await startSprintWithFallback();
      if (result.sessionId) {
        router.push(`/daily-sprint/${result.sessionId}?doc=${documentId}`);
      }
    } catch {
      setLoading(false);
    }
  };

  const handleBack = () => {
    analytics.capture("activation_cta_skipped", { document_id: documentId, session_id: sessionId });
    router.push("/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md [&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Your document is ready</DialogTitle>
          <DialogDescription>What would you like to do next?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
          <button
            onClick={handleBack}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-surface-border text-text-primary font-medium hover:bg-surface-card transition-colors"
          >
            Back to documents
          </button>
          {(() => {
            const isPreparing = !!precreateLoading && !precreatedSessionId;
            const buttonLabel = loading ? "Starting..." : isPreparing ? "Preparing your sprint..." : "Start your first sprint";
            return (
              <button
                onClick={handleStartSprint}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {(loading || isPreparing) && <Loader2 size={16} className="animate-spin" />}
                {buttonLabel}
              </button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
