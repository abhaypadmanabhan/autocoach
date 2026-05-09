"use client";

import Link from "next/link";
import { ToastProvider } from "@/components/ui/Toast";
import { BrandMark } from "@/components/primitives-acx/BrandMark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
        <header className="sticky top-0 z-10 flex items-center h-14 px-6 border-b border-[var(--line-subtle)] bg-[var(--bg-base)]/85 backdrop-blur">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark />
            <span className="font-semibold tracking-[-0.01em] text-[var(--fg-primary)]">
              AutoCoach
            </span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[380px] anim-auth-in">{children}</div>
        </main>
        <footer className="py-6 px-6 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
          © 2026 AutoCoach
        </footer>
      </div>
    </ToastProvider>
  );
}
