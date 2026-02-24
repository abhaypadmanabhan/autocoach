"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";
import { createBrowserClient } from "@/lib/supabase/client";
import type { SprintStatusResponse } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

function getPlanType(user: User): string {
    const appPlan = user.app_metadata?.plan_type;
    if (typeof appPlan === "string" && appPlan.length > 0) {
        return appPlan;
    }

    const userPlan = user.user_metadata?.plan_type;
    if (typeof userPlan === "string" && userPlan.length > 0) {
        return userPlan;
    }

    return "free";
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        analytics.init();
    }, []);

    useEffect(() => {
        const supabase = createBrowserClient();
        let isMounted = true;

        const identifyUser = async (user: User | null) => {
            if (!user || !isMounted) {
                return;
            }

            let xpTotal = 0;
            let streakCurrent = 0;

            try {
                const sprintStatus = await apiFetch<SprintStatusResponse>("/sprint/today");
                xpTotal = sprintStatus.total_xp ?? 0;
                streakCurrent = sprintStatus.streak_count ?? 0;
            } catch {
                // Keep defaults if stats call fails.
            }

            if (!isMounted) {
                return;
            }

            analytics.identify(user.id, {
                plan_type: getPlanType(user),
                xp_total: xpTotal,
                streak_current: streakCurrent,
            });
        };

        supabase.auth.getUser().then(({ data: { user } }) => {
            void identifyUser(user ?? null);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            void identifyUser(session?.user ?? null);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return <>{children}</>;
}
