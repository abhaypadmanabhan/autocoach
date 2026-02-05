"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Trash2, Mail, Key, CreditCard } from "lucide-react";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { createBrowserClient } from "@/lib/supabase/client";
import { useAvatar } from "@/hooks/useAvatar";
import { useToast } from "@/hooks/useToast";
import { staggerContainer, slideUpItem } from "@/lib/motions";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const { avatarUrl, uploading, uploadAvatar, deleteAvatar } = useAvatar(
    user?.id ?? null
  );

  useEffect(() => {
    const supabase = createBrowserClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadAvatar(file);
      showToast("Avatar updated successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to upload avatar",
        "error"
      );
    }

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar();
      showToast("Avatar removed", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete avatar",
        "error"
      );
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    setSendingReset(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/settings`,
      });

      if (error) throw error;

      showToast("Password reset email sent. Check your inbox.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to send reset email",
        "error"
      );
    } finally {
      setSendingReset(false);
    }
  };

  function getInitials(email: string | undefined): string {
    if (!email) return "?";
    return email.slice(0, 2).toUpperCase();
  }

  if (loading) {
    return (
      <AppShell showBack backHref="/dashboard" title="Settings">
        <PageContainer size="md">
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-brand-primary rotate-45"
              style={{ borderRadius: "4px" }}
            />
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell showBack backHref="/dashboard" title="Settings">
      <PageContainer size="md">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Profile Section */}
          <motion.section
            variants={slideUpItem}
            className="bg-surface-darker rounded-2xl border border-surface-border p-6"
          >
            <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                <Camera size={18} className="text-brand-primary" />
              </div>
              Profile
            </h2>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Avatar */}
              <div className="relative group">
                <button
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  className="relative w-24 h-24 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-surface-dark font-bold text-2xl overflow-hidden group-hover:opacity-90 transition-opacity disabled:cursor-wait"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="User avatar"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(user?.email)}</span>
                  )}

                  {/* Upload overlay */}
                  <div className="absolute inset-0 bg-surface-dark/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-6 h-6 border-2 border-text-primary border-t-transparent rounded-full"
                      />
                    ) : (
                      <Camera size={24} className="text-text-primary" />
                    )}
                  </div>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* User Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-text-muted mb-1">
                  <Mail size={14} />
                  <span className="text-xs uppercase tracking-wider">
                    Email
                  </span>
                </div>
                <p className="text-text-primary font-medium">{user?.email}</p>

                {avatarUrl && (
                  <button
                    onClick={handleDeleteAvatar}
                    className="mt-4 flex items-center gap-2 text-sm text-semantic-error hover:text-semantic-error/80 transition-colors"
                  >
                    <Trash2 size={16} />
                    Remove avatar
                  </button>
                )}
              </div>
            </div>
          </motion.section>

          {/* Security Section */}
          <motion.section
            variants={slideUpItem}
            className="bg-surface-darker rounded-2xl border border-surface-border p-6"
          >
            <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 flex items-center justify-center">
                <Key size={18} className="text-brand-secondary" />
              </div>
              Security
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-text-primary font-medium">Password</p>
                <p className="text-text-muted text-sm">
                  Receive an email to reset your password
                </p>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={sendingReset}
                className="px-4 py-2.5 rounded-xl bg-surface-border hover:bg-surface-border/70 text-text-primary font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingReset ? "Sending..." : "Change password"}
              </button>
            </div>
          </motion.section>

          {/* Subscription Section */}
          <motion.section
            variants={slideUpItem}
            className="bg-surface-darker rounded-2xl border border-surface-border p-6"
          >
            <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-semantic-success/10 flex items-center justify-center">
                <CreditCard size={18} className="text-semantic-success" />
              </div>
              Subscription
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-text-primary font-medium">Free Plan</p>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-surface-border text-text-muted">
                    Current
                  </span>
                </div>
                <p className="text-text-muted text-sm mt-1">
                  Upgrade coming soon
                </p>
              </div>

              <button
                disabled
                className="px-4 py-2.5 rounded-xl bg-brand-primary/10 text-brand-primary font-medium cursor-not-allowed opacity-50"
              >
                Upgrade
              </button>
            </div>
          </motion.section>
        </motion.div>
      </PageContainer>
    </AppShell>
  );
}
