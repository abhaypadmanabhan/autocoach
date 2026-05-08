"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { analytics } from "@/lib/analytics";
import { createBrowserClient } from "@/lib/supabase/client";
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

            analytics.identify(user.id, {
                plan_type: getPlanType(user),
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
