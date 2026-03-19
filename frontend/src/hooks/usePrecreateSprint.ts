"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import type { SprintQuiz } from "@/lib/types";

type PrecreateState = {
  precreatedSessionId: string | null;
  precreateLoading: boolean;
};

export function usePrecreateSprint(shouldFire: boolean): PrecreateState {
  const hasFiredRef = useRef(false);
  const [precreatedSessionId, setPrecreatedSessionId] = useState<string | null>(null);
  const [precreateLoading, setPrecreateLoading] = useState(false);

  useEffect(() => {
    if (!shouldFire || hasFiredRef.current) return;
    hasFiredRef.current = true;

    let cancelled = false;

    const run = async () => {
      setPrecreateLoading(true);
      try {
        const res = await apiFetch<SprintQuiz>("/sprint/start", { method: "POST", body: {} });
        if (cancelled) return;
        if (res.session_id) {
          setPrecreatedSessionId(res.session_id);
          analytics.capture("quiz_session_created", {
            session_id: res.session_id,
            source: "pre_create",
          });
        }
      } catch (err) {
        // Degrade gracefully — ActivationBanner falls back to slow path on click
        console.warn("[usePrecreateSprint] Background pre-creation failed:", err);
      } finally {
        if (!cancelled) setPrecreateLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [shouldFire]);

  return { precreatedSessionId, precreateLoading };
}
