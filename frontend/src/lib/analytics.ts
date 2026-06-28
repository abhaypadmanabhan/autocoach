"use client";

import posthog from "posthog-js";

let isInitialized = false;

const SENSITIVE_PROP_KEYS = new Set([
    "email",
    "token",
    "authorization",
    "raw_text",
    "content",
]);

let lastIdentifySignature: string | null = null;

function sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeValue(item))
            .filter((item) => item !== undefined);
    }

    if (value && typeof value === "object") {
        const sanitized: Record<string, unknown> = {};

        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            if (SENSITIVE_PROP_KEYS.has(key.toLowerCase())) {
                continue;
            }

            const nextValue = sanitizeValue(nestedValue);
            if (nextValue !== undefined) {
                sanitized[key] = nextValue;
            }
        }

        return sanitized;
    }

    return value;
}

export function sanitizeProps(props?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!props) {
        return undefined;
    }

    const sanitized = sanitizeValue(props);
    if (!sanitized || typeof sanitized !== "object") {
        return undefined;
    }

    const entries = Object.entries(sanitized as Record<string, unknown>);
    return entries.length > 0 ? (sanitized as Record<string, unknown>) : undefined;
}

export const analytics = {
    init: () => {
        if (isInitialized) return;
        if (typeof window === "undefined") return;

        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

        if (key) {
            posthog.init(key, {
                api_host: host,
                capture_pageview: false, // We'll manage this if needed
                disable_session_recording: true,
            });
            isInitialized = true;
            (window as Window & { posthog?: typeof posthog }).posthog = posthog;
            console.log("[posthog] init ok with host:", host);
        } else {
            console.warn("[posthog] init failed", {
                keyPresent: !!key,
                host: host,
            });
        }
    },

    identify: (userId: string, props?: Record<string, unknown>) => {
        if (
            typeof window !== "undefined" &&
            process.env.NEXT_PUBLIC_POSTHOG_KEY
        ) {
            const sanitizedProps = sanitizeProps(props);
            let signature = userId;
            try {
                signature = `${userId}:${JSON.stringify(sanitizedProps ?? {})}`;
            } catch {
                signature = `${userId}:unserializable`;
            }

            if (signature === lastIdentifySignature) {
                return;
            }

            lastIdentifySignature = signature;
            posthog.identify(userId, sanitizedProps);
        }
    },

    capture: (eventName: string, props?: Record<string, unknown>) => {
        if (
            typeof window !== "undefined" &&
            process.env.NEXT_PUBLIC_POSTHOG_KEY
        ) {
            posthog.capture(eventName, sanitizeProps(props));
        }
    },

    hasOptedOut: (): boolean => {
        if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            return false;
        }
        return posthog.has_opted_out_capturing();
    },

    optIn: () => {
        if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.opt_in_capturing();
        }
    },

    optOut: () => {
        if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.opt_out_capturing();
        }
    },
};
