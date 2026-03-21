import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Rubik } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { PosthogDebug } from "@/components/debug/PosthogDebug";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AutoCoach - AI Learning Platform",
  description: "Master any topic with AI-generated quizzes. Turn your documents into interactive learning experiences.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldRenderDebug = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true";

  return (
    <html lang="en" className="light">
      <body className={`${inter.variable} ${plusJakartaSans.variable} ${rubik.variable} font-sans antialiased`}>
        <AnalyticsProvider>
          {shouldRenderDebug && <PosthogDebug />}
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
