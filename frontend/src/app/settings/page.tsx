"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { createBrowserClient } from "@/lib/supabase/client";
import { analytics } from "@/lib/analytics";
import { useAvatar } from "@/hooks/useAvatar";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  const { avatarUrl, uploading, uploadAvatar, deleteAvatar } = useAvatar(
    user?.id ?? null,
  );

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoadingUser(false);
    });
  }, []);

  useEffect(() => {
    setAnalyticsEnabled(!analytics.hasOptedOut());
  }, []);

  const initials = (user?.email ?? "??").slice(0, 2).toUpperCase();

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAvatar(file);
      showToast("Avatar updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", "error");
    }
    e.target.value = "";
  };

  const onRemoveAvatar = async () => {
    try {
      await deleteAvatar();
      showToast("Avatar removed", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const onResetPassword = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/settings`,
      });
      if (error) throw error;
      showToast("Reset email sent", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send", "error");
    } finally {
      setSendingReset(false);
    }
  };

  const onAnalyticsToggle = (enabled: boolean) => {
    if (enabled) {
      analytics.optIn();
    } else {
      analytics.optOut();
    }
    setAnalyticsEnabled(enabled);
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <AppShell title="Settings" eyebrow="Account" showBack backHref="/dashboard">
      <PageContainer size="md">
        {loadingUser ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-tertiary)]" />
          </div>
        ) : (
          <div className="space-y-10 mt-2">
            <header className="pb-2">
              <p className="kicker">04 / SETTINGS</p>
              <h1 className="mt-2 font-display uppercase tracking-[-0.02em] text-[24px] text-[var(--ink)]">
                Settings
              </h1>
            </header>

            <SettingsRow label="01 / Profile">
              <div className="flex items-start gap-5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                      "relative h-24 w-24 overflow-hidden",
                      "border border-[var(--line-default)] bg-[var(--bg-elev)]",
                      "grid place-items-center font-mono text-[20px] text-[var(--ink)]",
                      "transition-[border-color] duration-[180ms] hover:border-[var(--line-strong)]",
                      "disabled:cursor-wait",
                    )}
                    aria-label="Upload avatar"
                  >
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar"
                        width={96}
                        height={96}
                        className="object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-[rgba(23,23,23,0.4)] opacity-0 hover:opacity-100 transition-opacity">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--bg-base)]" />
                      ) : (
                        <Camera className="h-4 w-4 text-[var(--bg-base)]" />
                      )}
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickFile}
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <Label variant="mono">Email</Label>
                    <Input value={user?.email ?? ""} disabled readOnly />
                  </div>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={onRemoveAvatar}
                      className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-tertiary)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>
            </SettingsRow>

            <SettingsRow label="02 / Security">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14px] font-medium text-[var(--fg-primary)]">
                    Password
                  </p>
                  <p className="text-[13px] text-[var(--fg-secondary)] mt-0.5">
                    Get an email to reset your password.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={onResetPassword}
                  disabled={sendingReset}
                >
                  {sendingReset ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending
                    </>
                  ) : (
                    "Send reset email"
                  )}
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow label="03 / Subscription">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-[var(--fg-primary)]">
                      Free plan
                    </p>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] px-1.5 py-px rounded-sm border border-[var(--line-default)] text-[var(--fg-tertiary)]">
                      Current
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--fg-secondary)] mt-0.5">
                    Unlimited uploads, adaptive sessions, smart review.
                  </p>
                </div>
                <Button variant="secondary" disabled>
                  Upgrade
                  <span className="ml-1 font-mono text-[10px] text-[var(--fg-disabled)]">
                    Soon
                  </span>
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow label="04 / Privacy">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label variant="mono">Analytics</Label>
                  <p className="text-[13px] text-[var(--fg-secondary)] mt-0.5">
                    Share anonymous usage events to help improve AutoCoach. No
                    document content or personal data is included.
                  </p>
                </div>
                <Checkbox
                  id="analytics-enabled"
                  checked={analyticsEnabled}
                  onCheckedChange={(checked) =>
                    onAnalyticsToggle(checked === true)
                  }
                  className="rounded-none"
                  aria-label="Enable analytics"
                />
              </div>
            </SettingsRow>

            <SettingsRow label="Danger zone" danger>
              <div className="flex items-center justify-between gap-4 border-2 border-[var(--danger)] p-4">
                <div>
                  <p className="text-[14px] font-medium text-[var(--danger)]">
                    Sign out
                  </p>
                  <p className="text-[13px] text-[var(--fg-secondary)] mt-0.5">
                    End your session on this device.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={signingOut}>
                      Sign out
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sign out?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You&apos;ll need to sign in again to continue. Active session
                        progress is saved.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onSignOut}>
                        Sign out
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </SettingsRow>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}

function SettingsRow({
  label,
  danger,
  children,
}: {
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 md:gap-8 pt-8 border-t border-[var(--line-subtle)] first:border-t-0 first:pt-0">
      <h2 className={cn("kicker pt-1", danger && "text-[var(--danger)]")}>
        {label}
      </h2>
      <div>{children}</div>
    </section>
  );
}
