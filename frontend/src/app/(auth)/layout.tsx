"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Brain, Sparkles, Star } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background-light">
      {/* Left Side - Decorative Panel (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-indigo-space">
        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-space via-indigo-space to-indigo-space-light" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-mesh-orb-1" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-400/10 rounded-full blur-[80px] animate-mesh-orb-2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        {/* Dot grid pattern for depth */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo - Using actual brand mascot */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/">
              <Logo size="lg" animated />
            </Link>
          </motion.div>

          {/* Center Content */}
          <div className="flex-1 flex flex-col justify-center py-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-md"
            >
              <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6 font-heading">
                Transform how you{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">
                  learn
                </span>
              </h2>
              <p className="text-white/70 text-lg leading-relaxed mb-10">
                Upload your documents and let AI create personalized quizzes.
                Master any subject with intelligent, adaptive learning.
              </p>

              {/* Feature highlights */}
              <div className="space-y-4">
                {[
                  { icon: BookOpen, text: "PDF & PowerPoint support" },
                  { icon: Brain, text: "AI-powered question generation" },
                  { icon: Sparkles, text: "Instant feedback & analytics" },
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-4 group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 transition-all duration-300 group-hover:bg-white/15 group-hover:border-white/20 group-hover:scale-105">
                      <feature.icon size={18} className="text-primary" />
                    </div>
                    <span className="text-white/80 font-medium group-hover:text-white transition-colors duration-300">{feature.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Bottom testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/[0.07] transition-colors duration-300"
          >
            {/* Star rating */}
            <div className="flex gap-0.5 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-white/80 italic mb-4 leading-relaxed">
              &ldquo;AutoCoach helped me ace my finals. The AI-generated quizzes
              were spot-on with the material!&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-orange-400/40 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10">
                SC
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Sarah Chen</p>
                <p className="text-white/50 text-xs">Medical Student</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col">
        {/* Mobile Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="lg:hidden w-full bg-white/80 backdrop-blur-sm border-b border-slate-border/50 py-4 px-6"
        >
          <Link href="/">
            <Logo size="md" animated />
          </Link>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center py-8 lg:py-12 px-6 sm:px-8 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[420px]"
          >
            {children}
          </motion.div>
        </main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="py-6 px-6 text-center"
        >
          <p className="text-sm text-slate-text">
            © 2026 AutoCoach. All rights reserved.
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
