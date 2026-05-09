import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { PosthogDebug } from "@/components/debug/PosthogDebug";

export const metadata: Metadata = {
  title: "AutoCoach — Master any topic, faster",
  description: "Turn documents into adaptive quizzes. AI-powered tutoring with spaced repetition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldRenderDebug =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true";

  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <AnalyticsProvider>
          {shouldRenderDebug && <PosthogDebug />}
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
