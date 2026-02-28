import PostHog from 'posthog-react-native';

let client: PostHog | null = null;

const SENSITIVE_PROP_KEYS = new Set(['email', 'token', 'authorization', 'raw_text', 'content']);

function sanitizeProps(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!SENSITIVE_PROP_KEYS.has(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export const analytics = {
  init: () => {
    const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
    const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (key && !client) {
      client = new PostHog(key, { host });
    }
  },

  identify: (userId: string, props?: Record<string, unknown>) => {
    if (!client) return;
    const sanitizedProps = sanitizeProps(props);
    client.identify(userId, sanitizedProps as any);
  },

  capture: (eventName: string, props?: Record<string, unknown>) => {
    if (!client) return;
    const sanitizedProps = sanitizeProps({ ...props, platform: 'ios' });
    client.capture(eventName, sanitizedProps as any);
  },

  reset: () => {
    if (!client) return;
    client.reset();
  },
};
