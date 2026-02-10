"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle,
  Sparkles,
  Eye,
  EyeOff,
  User,
  Check,
  AlertCircle,
  PartyPopper,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@/lib/supabase/client";
import { signupSchema, type SignupFormData } from "@/lib/validation/auth";
import { Button } from "@/components/primitives/Button";
import { Input, Label } from "@/components/primitives/Input";
import { Checkbox } from "@/components/primitives/Checkbox";
import { SocialButtons } from "@/components/auth/SocialButtons";

const inputClassName =
  "h-auto pl-12 pr-4 py-3 border-slate-border rounded-xl bg-white shadow-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus-visible:ring-0 text-indigo-space placeholder:text-slate-text/60";

// Password strength checker
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-error", textColor: "text-error" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-400", textColor: "text-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-400", textColor: "text-yellow-600" };
  return { score, label: "Strong", color: "bg-success", textColor: "text-success" };
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
  const passwordStrength = getPasswordStrength(watchedPassword);

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true);
    setServerError(null);
    setSuccess(false);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.name,
        },
      },
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

    // Placeholder - In production, implement actual OAuth
    setTimeout(() => {
      setSocialLoading(null);
      setServerError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} signup coming soon!`);
    }, 1000);
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
          className="relative mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-success/10 mb-6"
        >
          <CheckCircle className="h-10 w-10 text-success" />
          {/* Celebration sparkles */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
            className="absolute -top-2 -right-2"
          >
            <PartyPopper className="h-6 w-6 text-primary" />
          </motion.div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-extrabold text-indigo-space mb-3 font-heading"
        >
          You&apos;re all set!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-text mb-2 leading-relaxed"
        >
          We&apos;ve sent a confirmation link to
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 bg-indigo-space/5 text-indigo-space font-semibold px-4 py-2 rounded-lg text-sm">
            <Mail className="h-4 w-4" />
            {getValues("email")}
          </span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-slate-text mb-8"
        >
          Click the link in your email to activate your account and start learning.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to login
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary mb-4"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Start for free
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-extrabold text-indigo-space font-heading"
        >
          Create your account
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-slate-text"
        >
          Join thousands of learners on AutoCoach
        </motion.p>
      </div>

      {/* Social Signup Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6"
      >
        <SocialButtons
          onSocialLogin={handleSocialSignup}
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
            or sign up with email
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

      {/* Signup Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Name Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Label htmlFor="name" className="block text-indigo-space mb-2 text-sm font-medium">
            Full name
          </Label>
          <div className="relative group/input">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-slate-text/70 transition-colors duration-200 group-focus-within/input:text-primary" />
            </div>
            <Input
              id="name"
              type="text"
              autoFocus
              placeholder="John Doe"
              {...register("name")}
              className={inputClassName}
            />
          </div>
          {errors.name && (
            <p className="mt-1.5 text-xs text-error flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.name.message}
            </p>
          )}
        </motion.div>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
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

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Label htmlFor="password" className="block text-indigo-space mb-2 text-sm font-medium">
            Password
          </Label>
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

          {/* Password Strength Indicator */}
          {watchedPassword.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3"
            >
              <div className="flex items-center gap-3 mb-2.5">
                {/* Segmented strength bar */}
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((segment) => (
                    <div
                      key={segment}
                      className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-border/40 transition-all duration-300"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          segment <= passwordStrength.score ? passwordStrength.color : "bg-transparent"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <span className={`text-xs font-semibold ${passwordStrength.textColor} min-w-[44px] text-right`}>
                  {passwordStrength.label}
                </span>
              </div>
              <ul className="space-y-1.5">
                {[
                  { check: watchedPassword.length >= 6, text: "At least 6 characters" },
                  { check: /[A-Z]/.test(watchedPassword), text: "One uppercase letter" },
                  { check: /[0-9]/.test(watchedPassword), text: "One number" },
                ].map((req, i) => (
                  <li
                    key={i}
                    className={`text-xs flex items-center gap-2 transition-colors duration-200 ${
                      req.check ? "text-success" : "text-slate-text/50"
                    }`}
                  >
                    <div className={`flex items-center justify-center w-4 h-4 rounded-full transition-all duration-200 ${
                      req.check ? "bg-success/10" : "bg-slate-border/30"
                    }`}>
                      <Check className={`h-2.5 w-2.5 transition-all duration-200 ${req.check ? "opacity-100" : "opacity-30"}`} />
                    </div>
                    {req.text}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </motion.div>

        {/* Terms Checkbox */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-3"
        >
          <Controller
            name="agreedToTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="terms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-0.5 h-5 w-5 rounded border-2 border-slate-border data-[state=checked]:border-primary transition-colors duration-200"
              />
            )}
          />
          <div>
            <label htmlFor="terms" className="text-sm text-slate-text leading-relaxed cursor-pointer">
              I agree to the{" "}
              <Link href="#" className="text-primary hover:text-primary-dark font-medium transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-primary hover:text-primary-dark font-medium transition-colors">
                Privacy Policy
              </Link>
            </label>
            {errors.agreedToTerms && (
              <p className="mt-1 text-xs text-error flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.agreedToTerms.message}
              </p>
            )}
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
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
                Creating account...
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Login Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 text-center"
      >
        <p className="text-sm text-slate-text">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
