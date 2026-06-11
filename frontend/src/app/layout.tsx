import type { Metadata } from "next";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { PosthogDebug } from "@/components/debug/PosthogDebug";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-sp",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-sp",
});

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
    <html lang="en">
      <body className={`${body.variable} ${display.variable} ${mono.variable} font-sans antialiased`}>
        <AnalyticsProvider>
          {shouldRenderDebug && <PosthogDebug />}
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
