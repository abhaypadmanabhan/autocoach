"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    instance = createBrowserClient();
  }
  return instance;
}
