"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBrowserClient } from "@/lib/supabase/client";
import { loginSchema, type LoginFormData } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { analytics } from "@/lib/analytics";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/dashboard");
    });
  }, [router]);

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }
    analytics.capture("sign_in");
    router.push("/dashboard");
    router.refresh();
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    setServerError(null);
    setTimeout(() => {
      setSocialLoading(null);
      setServerError(`${provider === "google" ? "Google" : "Apple"} sign-in coming soon`);
    }, 800);
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display uppercase text-[28px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
          Welcome back
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--fg-secondary)]">
          Sign in to continue learning
        </p>
      </div>

      <SocialButtons
        onSocialLogin={handleSocialLogin}
        loading={socialLoading}
        disabled={loading}
      />

      <div className="relative my-6">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 bg-[var(--bg-base)] font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
          or with email
        </span>
      </div>

      {serverError && (
        <div
          className="mb-5 flex items-start gap-2 px-3 py-2.5 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[13px] text-[var(--danger)]"
          role="alert"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" variant="mono">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-[12px] text-[var(--danger)] flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password" variant="mono">
              Password
            </Label>
            <Link
              href="#"
              className="text-[11px] text-[var(--accent-text)] hover:text-[var(--ink)] transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              aria-invalid={!!errors.password}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-7 w-7 rounded-sm text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[12px] text-[var(--danger)] flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          block
          disabled={loading || socialLoading !== null}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Signing in
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-7 text-center text-[13px] text-[var(--fg-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-[var(--accent-text)] hover:text-[var(--ink)] transition-colors"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
