"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/client";
import { loginSchema, type LoginFormData } from "@/lib/validation/auth";
import { Button } from "@/components/primitives/Button";
import { Input, Label } from "@/components/primitives/Input";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { analytics } from "@/lib/analytics";

const inputClassName =
  "h-auto pl-12 pr-4 py-3 border-slate-border rounded-xl bg-white shadow-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus-visible:ring-0 text-indigo-space placeholder:text-slate-text/60";

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

  // Redirect if already authenticated
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/dashboard");
      }
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

    // Placeholder - In production, implement actual OAuth
    setTimeout(() => {
      setSocialLoading(null);
      setServerError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon!`);
    }, 1000);
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-extrabold text-indigo-space font-heading"
        >
          Welcome back
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-slate-text"
        >
          Sign in to continue your learning journey
        </motion.p>
      </div>

      {/* Social Login Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6"
      >
        <SocialButtons
          onSocialLogin={handleSocialLogin}
          loading={socialLoading}
          disabled={loading}
        />
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-border/70"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background-light text-slate-text/80 text-xs uppercase tracking-wider font-medium">
            or continue with email
          </span>
        </div>
      </motion.div>

      {/* Error Message */}
      {serverError && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mb-5 bg-error-light border border-error/20 text-error px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </motion.div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Label htmlFor="email" className="block text-indigo-space mb-2 text-sm font-medium">
            Email address
          </Label>
          <div className="relative group/input">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-text/70 transition-colors duration-200 group-focus-within/input:text-primary" />
            </div>
            <Input
              id="email"
              type="email"
              autoFocus
              placeholder="you@example.com"
              {...register("email")}
              className={inputClassName}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-error flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.email.message}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="password" className="text-indigo-space text-sm font-medium">
              Password
            </Label>
            <Link
              href="#"
              className="text-xs text-primary hover:text-primary-dark transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative group/input">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-text/70 transition-colors duration-200 group-focus-within/input:text-primary" />
            </div>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
              className={`${inputClassName} !pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-text/70 hover:text-indigo-space transition-colors duration-200"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-error flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.password.message}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="pt-1"
        >
          <Button
            type="submit"
            disabled={loading || socialLoading !== null}
            className="w-full gap-2 h-auto py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 hover:bg-primary-dark transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Sign Up Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <p className="text-sm text-slate-text">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            Create account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
