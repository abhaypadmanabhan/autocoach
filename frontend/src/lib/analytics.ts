import posthog from "posthog-js";

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
        if (
            typeof window !== "undefined" &&
            process.env.NEXT_PUBLIC_POSTHOG_KEY &&
            process.env.NEXT_PUBLIC_POSTHOG_HOST
        ) {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
                capture_pageview: false, // We'll manage this if needed
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
};
