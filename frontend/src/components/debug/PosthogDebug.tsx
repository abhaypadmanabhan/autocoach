"use client";

import { useEffect } from "react";

export function PosthogDebug() {
    useEffect(() => {
        // Slight delay to ensure AnalyticsProvider init has run
        const timer = setTimeout(() => {
            console.log("[posthog-debug]", {
                keyPresent: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
                host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
                hasWindowPosthog: typeof window !== "undefined" && !!(window as Window & { posthog?: unknown }).posthog
            });
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    return null;
}
