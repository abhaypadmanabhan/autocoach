"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBrowserClient } from "@/lib/supabase/client";
import { signupSchema, type SignupFormData } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { SocialButtons } from "@/components/auth/SocialButtons";

type StrengthLabel = "Weak" | "Fair" | "Good" | "Strong";

function getPasswordStrength(password: string): {
  score: number;
  label: StrengthLabel;
  classes: string;
} {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", classes: "bg-[var(--danger)] text-[var(--danger)]" };
  if (score <= 2) return { score, label: "Fair", classes: "bg-[var(--warning)] text-[var(--warning)]" };
  if (score <= 3) return { score, label: "Good", classes: "bg-[var(--accent)] text-[var(--accent)]" };
  return { score, label: "Strong", classes: "bg-[var(--success)] text-[var(--success)]" };
}

export default function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { agreedToTerms: false },
  });

  const watchedPassword = watch("password", "");
  const strength = getPasswordStrength(watchedPassword);

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    setServerError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name } },
    });
    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  const handleSocialSignup = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    setServerError(null);
    setTimeout(() => {
      setSocialLoading(null);
      setServerError(`${provider === "google" ? "Google" : "Apple"} sign-up coming soon`);
    }, 800);
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto h-14 w-14 rounded-full grid place-items-center bg-[color-mix(in_oklab,var(--success)_8%,var(--bg-elev))] border border-[color-mix(in_oklab,var(--success)_30%,var(--line-default))] mb-5">
          <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
        </div>
        <h2 className="text-[24px] font-medium tracking-[-0.02em] text-[var(--fg-primary)] mb-2">
          Check your inbox
        </h2>
        <p className="text-[14px] text-[var(--fg-secondary)] mb-3">
          We sent a confirmation link to
        </p>
        <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--line-default)] bg-[var(--bg-elev)] font-mono text-[12px] text-[var(--fg-primary)] mb-6">
          <Mail className="h-3.5 w-3.5 text-[var(--fg-tertiary)]" />
          {getValues("email")}
        </p>
        <p className="text-[12px] text-[var(--fg-tertiary)] mb-7">
          Click the link to activate your account.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
          Create account
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--fg-secondary)]">
          Start mastering any topic, free
        </p>
      </div>

      <SocialButtons
        onSocialLogin={handleSocialSignup}
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
          <Label htmlFor="name" variant="mono">
            Full name
          </Label>
          <Input id="name" autoFocus autoComplete="name" {...register("name")} />
          {errors.name && (
            <p className="text-[12px] text-[var(--danger)]">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" variant="mono">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-[12px] text-[var(--danger)]">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" variant="mono">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              {...register("password")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-7 w-7 rounded-sm text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          {watchedPassword.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map((seg) => {
                    const filled = strength.score - 1 >= seg;
                    return (
                      <div
                        key={seg}
                        className="flex-1 h-[3px] rounded-full bg-[var(--bg-elev)] overflow-hidden"
                      >
                        <div
                          className={`h-full transition-all duration-300 ${filled ? strength.classes.split(" ")[0] : ""}`}
                          style={{ width: filled ? "100%" : "0%" }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span
                  className={`font-mono text-[10.5px] uppercase tracking-[0.08em] ${strength.classes.split(" ")[1]}`}
                >
                  {strength.label}
                </span>
              </div>
            </div>
          )}

          {errors.password && (
            <p className="text-[12px] text-[var(--danger)]">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <Controller
            name="agreedToTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="terms"
                checked={field.value}
                onCheckedChange={(c) => field.onChange(c === true)}
                className="mt-0.5"
              />
            )}
          />
          <label
            htmlFor="terms"
            className="text-[12px] text-[var(--fg-secondary)] leading-relaxed cursor-pointer"
          >
            I agree to the{" "}
            <Link href="#" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.agreedToTerms && (
          <p className="text-[12px] text-[var(--danger)] -mt-3">
            {errors.agreedToTerms.message}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          block
          disabled={loading || socialLoading !== null}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating account
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-7 text-center text-[13px] text-[var(--fg-secondary)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
