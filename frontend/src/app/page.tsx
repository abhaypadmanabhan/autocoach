"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import {
  PlayCircle,
  Sparkles,
  LogIn,
  Menu,
  X,
  FileText,
  Brain,
  CheckCircle,
  BarChart3,
  FileUp,
  Zap,
  ChevronDown,
  Star,
  Twitter,
  Linkedin,
  Github,
  Upload,
  Loader2,
  Check,
  ArrowRight,
  Lightbulb,
  Target,
  Clock,
  Award,
  MessageCircle,
} from "lucide-react";

// Shadcn components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Animated backgrounds
import { HeroBackground, SectionBackground } from "@/components/ui/animated-background";

// Brand components
import { Logo, LogoFull } from "@/components/brand/Logo";
import { HeroMascot, MascotGuide } from "@/components/brand/MascotGuide";
import { cn } from "@/lib/utils";

// ============================================
// NAVIGATION COMPONENT
// ============================================
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#testimonials", label: "Testimonials" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled 
            ? "glass border-b border-[var(--surface-border)]" 
            : "bg-transparent"
        )}
      >
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="flex h-16 lg:h-20 items-center justify-between">
            {/* Logo with Mascot */}
            <Link href="/" className="flex items-center">
              <Logo size="lg" animated />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex flex-1 items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-8"
              >
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="relative text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-2 group"
                  >
                    {link.label}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[var(--brand-primary)] transition-all duration-300 group-hover:w-full" />
                  </a>
                ))}
              </motion.div>
            </div>

            {/* Desktop Auth Buttons */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="hidden lg:flex items-center gap-3"
            >
              <Button variant="ghost" asChild>
                <Link href="/login" className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Log In
                </Link>
              </Button>
              <Button asChild className="shadow-lg shadow-[var(--brand-primary)]/20">
                <Link href="/signup">
                  Sign Up
                </Link>
              </Button>
            </motion.div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-card)] transition-colors"
            >
              <Menu size={24} className="text-[var(--text-primary)]" />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: mobileMenuOpen ? 0 : "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-[var(--surface-dark)] z-50 lg:hidden shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <Logo size="sm" animated={false} />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-[var(--surface-card)] transition-colors"
            >
              <X size={24} className="text-[var(--text-primary)]" />
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] transition-all py-3 px-4 rounded-xl"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-[var(--surface-border)] flex flex-col gap-3">
            <Button variant="outline" asChild className="w-full justify-center">
              <Link href="/login">
                <LogIn className="w-4 h-4 mr-2" />
                Log In
              </Link>
            </Button>
            <Button asChild className="w-full justify-center">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ============================================
// HERO SECTION
// ============================================
function HeroSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen pt-24 lg:pt-32 pb-16 lg:pb-24 overflow-hidden"
    >
      {/* Animated Background */}
      <HeroBackground />

      <motion.div 
        className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8"
        style={{ y, opacity }}
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="flex flex-col items-start gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium border-[var(--brand-primary)]/30 bg-[var(--surface-card)]/50 backdrop-blur-sm">
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex h-2 w-2 rounded-full bg-[var(--brand-primary)] mr-2"
                />
                AI-Powered Learning Platform
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)] font-heading"
            >
              Master Any Topic with{" "}
              <span className="gradient-text">AI-Generated</span> Quizzes
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg lg:text-xl text-[var(--text-secondary)] leading-relaxed max-w-lg"
            >
              Transform your documents, notes, and lectures into interactive learning
              experiences. AutoCoach adapts to your pace and helps you retain more.
            </motion.p>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="flex flex-wrap items-center gap-6 text-sm text-[var(--text-secondary)]"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--brand-primary)]/30 to-[var(--brand-secondary)]/30 border-2 border-[var(--surface-dark)] flex items-center justify-center text-xs font-medium text-[var(--text-primary)]"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <span className="font-medium text-[var(--text-primary)]">10,000+ students</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      className="text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>
                <span className="font-medium text-[var(--text-primary)]">98% satisfaction</span>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-2"
            >
              <Button size="lg" asChild className="text-base shadow-xl shadow-[var(--brand-primary)]/20 animate-pulse-subtle">
                <Link href="/signup">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Your First Quiz
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-base border-[var(--surface-border)]">
                <Link href="#demo">
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Watch Demo
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Right Content - Hero Mascot + Demo Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative flex flex-col items-center gap-8"
          >
            {/* Large Hero Mascot */}
            <HeroMascot />

            {/* Demo Card below mascot */}
            <div className="w-full max-w-md demo-window">
              <div className="demo-window-header">
                <div className="demo-window-dot red" />
                <div className="demo-window-dot yellow" />
                <div className="demo-window-dot green" />
                <span className="ml-4 text-xs text-gray-500 font-medium">
                  AutoCoach Dashboard
                </span>
              </div>
              <div className="p-6 bg-gradient-to-br from-[var(--background-light)] to-white min-h-[200px]">
                {/* Mock Quiz Interface */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center">
                        <FileText size={16} className="text-[var(--brand-primary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--indigo-space)]">
                          Machine Learning Basics
                        </p>
                        <p className="text-xs text-[var(--slate-text)]">12 questions</p>
                      </div>
                    </div>
                    <Badge className="bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20">
                      In Progress
                    </Badge>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-[var(--slate-border)]/50 shadow-sm">
                    <p className="text-xs text-[var(--brand-primary)] font-medium mb-2">
                      Question 3 of 12
                    </p>
                    <p className="text-sm font-medium text-[var(--indigo-space)] mb-4">
                      What is the primary goal of supervised learning?
                    </p>
                    <div className="space-y-2">
                      {[
                        "Learn from labeled data",
                        "Find hidden patterns",
                        "Maximize rewards",
                        "Reduce dimensions",
                      ].map((option, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className={cn(
                            "p-3 rounded-lg border text-sm cursor-pointer transition-all",
                            i === 0
                              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--brand-primary)] font-medium"
                              : "border-[var(--slate-border)]/50 text-slate-600 hover:border-[var(--brand-primary)]/30"
                          )}
                        >
                          {option}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating annotation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="absolute -bottom-4 -left-4 lg:-left-8 bg-[var(--surface-card)] rounded-xl p-3 shadow-lg border border-[var(--surface-border)]"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
                  <Check size={16} className="text-[var(--success)]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    Instant Feedback
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">AI evaluates your answers</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-[var(--text-muted)]">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-5 h-8 rounded-full border-2 border-[var(--surface-border)] flex justify-center pt-2"
        >
          <motion.div className="w-1 h-2 rounded-full bg-[var(--brand-primary)]" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ============================================
// FEATURES SECTION
// ============================================
function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Quiz Generation",
      description:
        "Advanced AI analyzes your documents and creates relevant, challenging questions tailored to the content.",
    },
    {
      icon: FileText,
      title: "Multiple Question Types",
      description:
        "Support for MCQ, True/False, and Free Text questions to test different levels of understanding.",
    },
    {
      icon: CheckCircle,
      title: "Smart Answer Evaluation",
      description:
        "AI evaluates free-text responses for semantic correctness, not just exact matches.",
    },
    {
      icon: BarChart3,
      title: "Progress Tracking",
      description:
        "Track your learning journey with detailed analytics on performance and areas for improvement.",
    },
    {
      icon: FileUp,
      title: "Document Processing",
      description:
        "Upload PDFs and PowerPoint files. Our system extracts and processes content automatically.",
    },
    {
      icon: Zap,
      title: "Adaptive Learning",
      description:
        "The system adapts to your performance, focusing on areas where you need more practice.",
    },
  ];

  return (
    <section id="features" className="section-padding relative">
      {/* Animated Background */}
      <SectionBackground variant="default" />

      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20">
            Features
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-4 font-heading">
            Everything You Need to Learn Smarter
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-lg">
            Powerful features designed to transform how you study and retain information
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className="h-full bg-[var(--surface-card)] border-[var(--surface-border)] hover:border-[var(--brand-primary)]/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--brand-primary)]/5">
                <CardHeader className="pb-3">
                  <div className="feature-icon">
                    <feature.icon size={24} className="text-[var(--brand-primary)]" />
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3 font-heading">
                    {feature.title}
                  </h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// HOW IT WORKS SECTION
// ============================================
function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Upload Your Documents",
      description:
        "Simply drag and drop your PDF or PowerPoint files. Our system handles the rest.",
      icon: Upload,
    },
    {
      number: "02",
      title: "AI Generates Quizzes",
      description:
        "Our AI analyzes your content and creates personalized quiz questions in seconds.",
      icon: Brain,
    },
    {
      number: "03",
      title: "Practice and Master",
      description:
        "Take quizzes, get instant feedback, and track your progress as you learn.",
      icon: CheckCircle,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="section-padding relative"
    >
      {/* Animated Background */}
      <SectionBackground variant="gradient" />
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20">
            How It Works
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-4 font-heading">
            Three Simple Steps to Success
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-lg">
            Get started in minutes and transform your learning experience
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--brand-primary)]/30 origin-left"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
                className="relative text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--surface-card)] border-2 border-[var(--brand-primary)]/20 shadow-lg shadow-[var(--brand-primary)]/10 mb-6 z-10"
                >
                  <step.icon size={32} className="text-[var(--brand-primary)]" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--brand-primary)] text-[var(--surface-dark)] text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </motion.div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3 font-heading">
                  {step.title}
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// INTERACTIVE DEMO SECTION
// ============================================
function DemoSection() {
  const [isInView, setIsInView] = useState(false);
  const [stage, setStage] = useState(0);

  const stages = [
    { name: "Upload", duration: 3000 },
    { name: "Processing", duration: 2000 },
    { name: "Quiz", duration: 4000 },
    { name: "Answer", duration: 2000 },
    { name: "Feedback", duration: 2000 },
  ];

  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setStage((prev) => (prev + 1) % stages.length);
    }, stages[stage].duration);

    return () => clearInterval(interval);
  }, [isInView, stage]);

  return (
    <section
      id="demo"
      className="section-padding relative overflow-hidden"
    >
      {/* Animated Background */}
      <SectionBackground variant="mesh" />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          onViewportEnter={() => setIsInView(true)}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-white/10 text-white/90 hover:bg-white/20">
            See It In Action
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-4 font-heading">
            Watch AutoCoach Work Its Magic
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-lg">
            From document upload to quiz mastery in seconds
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Demo Window */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="demo-window"
          >
            <div className="demo-window-header">
              <div className="demo-window-dot red" />
              <div className="demo-window-dot yellow" />
              <div className="demo-window-dot green" />
              <span className="ml-4 text-xs text-gray-500 font-medium">AutoCoach</span>
            </div>
            <div className="p-6 bg-[var(--surface-dark)] min-h-[300px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                {stage === 0 && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--brand-primary)]/10 flex items-center justify-center"
                    >
                      <Upload size={32} className="text-[var(--brand-primary)]" />
                    </motion.div>
                    <p className="text-[var(--text-primary)] font-medium mb-2">
                      Uploading document...
                    </p>
                    <div className="w-48 h-2 mx-auto rounded-full bg-[var(--surface-border)]/30 overflow-hidden">
                      <motion.div
                        className="h-full bg-[var(--brand-primary)] rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2.5 }}
                      />
                    </div>
                  </motion.div>
                )}

                {stage === 1 && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-16 h-16 mx-auto mb-4"
                    >
                      <Loader2 size={64} className="text-[var(--brand-primary)]" />
                    </motion.div>
                    <p className="text-[var(--text-primary)] font-medium mb-2">
                      AI is analyzing content...
                    </p>
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="flex justify-center gap-1"
                    >
                      <Sparkles size={16} className="text-[var(--brand-primary)]" />
                      <Sparkles size={16} className="text-[var(--brand-secondary)]" />
                      <Sparkles size={16} className="text-[var(--brand-primary)]" />
                    </motion.div>
                  </motion.div>
                )}

                {stage === 2 && (
                  <motion.div
                    key="quiz"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-sm"
                  >
                    <p className="text-xs text-[var(--brand-primary)] font-medium mb-2">
                      Question 1 of 10
                    </p>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-4">
                      What is the capital of France?
                    </p>
                    <div className="space-y-2">
                      {["Paris", "London", "Berlin", "Madrid"].map((opt, i) => (
                        <motion.div
                          key={opt}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.15 }}
                          className="p-3 rounded-lg border border-[var(--surface-border)] text-sm text-[var(--text-secondary)]"
                        >
                          {opt}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {stage === 3 && (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-sm"
                  >
                    <p className="text-xs text-[var(--brand-primary)] font-medium mb-2">
                      Question 1 of 10
                    </p>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-4">
                      What is the capital of France?
                    </p>
                    <div className="space-y-2">
                      {["Paris", "London", "Berlin", "Madrid"].map((opt, i) => (
                        <div
                          key={opt}
                          className={cn(
                            "p-3 rounded-lg border text-sm transition-all",
                            i === 0
                              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-medium"
                              : "border-[var(--surface-border)] text-[var(--text-secondary)]"
                          )}
                        >
                          {opt}
                          {i === 0 && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="float-right"
                            >
                              <Check size={16} className="text-[var(--brand-primary)]" />
                            </motion.span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {stage === 4 && (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 10 }}
                      className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--success)]/10 flex items-center justify-center"
                    >
                      <Check size={40} className="text-[var(--success)]" />
                    </motion.div>
                    <p className="text-xl font-bold text-[var(--success)] mb-2">Correct!</p>
                    <p className="text-[var(--text-secondary)] text-sm mb-4">
                      Paris is the capital of France.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">Score:</span>
                      <span className="font-bold text-[var(--text-primary)]">1/1</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Stage Descriptions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-6"
          >
            {stages.map((s, i) => (
              <motion.div
                key={s.name}
                animate={{ opacity: stage === i ? 1 : 0.4 }}
                className="flex items-start gap-4"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                    stage === i 
                      ? "bg-[var(--brand-primary)] text-[var(--surface-dark)]" 
                      : "bg-[var(--surface-card)] text-[var(--text-muted)]"
                  )}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <h4
                    className={cn(
                      "font-bold mb-1 transition-colors",
                      stage === i ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                    )}
                  >
                    {s.name}
                  </h4>
                  <p className={cn(
                    "text-sm",
                    stage === i ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                  )}>
                    {i === 0 && "Drag and drop your document to upload"}
                    {i === 1 && "AI extracts content and generates questions"}
                    {i === 2 && "Questions appear with multiple choice options"}
                    {i === 3 && "Select your answer and submit"}
                    {i === 4 && "Get instant feedback and explanations"}
                  </p>
                </div>

              </motion.div>
            ))}

            {/* Stage Progress Dots */}
            <div className="flex items-center gap-2 pt-4">
              {stages.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: stage === i ? 1.25 : 1,
                    backgroundColor: stage === i ? "var(--brand-primary)" : "var(--surface-border)",
                  }}
                  className="w-2.5 h-2.5 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
// ============================================
// TESTIMONIALS SECTION
// ============================================
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Medical Student",
      content:
        "AutoCoach transformed my study routine. I went from struggling with anatomy to acing my exams. The AI-generated questions are incredibly relevant.",
      avatar: "SC",
    },
    {
      name: "James Wilson",
      role: "College Student",
      content:
        "I upload my lecture notes and have practice quizzes ready in seconds. It's like having a personal tutor available 24/7.",
      avatar: "JW",
    },
    {
      name: "Maria Garcia",
      role: "High School Teacher",
      content:
        "I use AutoCoach to create quizzes for my students. It saves me hours of work and the questions are always on point.",
      avatar: "MG",
    },
    {
      name: "David Park",
      role: "Working Professional",
      content:
        "Studying for my certification while working full-time seemed impossible. AutoCoach made it manageable and even enjoyable.",
      avatar: "DP",
    },
  ];

  return (
    <section id="testimonials" className="section-padding relative">
      {/* Animated Background */}
      <SectionBackground variant="default" />
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20">
            Testimonials
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-4 font-heading">
            Loved by Students Everywhere
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-lg">
            Join thousands of learners who have transformed their study habits
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className="h-full bg-[var(--surface-card)] border-[var(--surface-border)] hover:border-[var(--brand-primary)]/30 transition-all hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className="text-yellow-400 fill-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4 italic">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[var(--surface-border)]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-primary)]/30 to-[var(--brand-secondary)]/30 flex items-center justify-center text-sm font-bold text-[var(--text-primary)]">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)] text-sm">
                        {testimonial.name}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// PRICING SECTION
// ============================================
function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Free",
      price: { monthly: 0, yearly: 0 },
      description: "Perfect for getting started",
      features: [
        "5 documents per month",
        "10 quizzes per day",
        "Basic question types (MCQ, T/F)",
        "Community support",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      price: { monthly: 9, yearly: 7 },
      description: "For serious learners",
      features: [
        "Unlimited documents",
        "Unlimited quizzes",
        "All question types including Free Text",
        "Advanced analytics",
        "Priority support",
        "Export results",
      ],
      cta: "Start Pro Trial",
      popular: true,
    },
  ];

  return (
    <section id="pricing" className="section-padding relative">
      {/* Animated Background */}
      <SectionBackground variant="mesh" />
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20">
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-4 font-heading">
            Simple, Transparent Pricing
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto text-lg mb-8">
            Choose the plan that fits your learning journey
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                !isYearly ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
              )}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-7 rounded-full bg-[var(--surface-card)] transition-colors"
            >
              <motion.div
                animate={{ x: isYearly ? 26 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-[var(--brand-primary)]"
              />
            </button>
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                isYearly ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
              )}
            >
              Yearly{" "}
              <span className="text-[var(--success)] text-xs font-bold">Save 22%</span>
            </span>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className={cn(
                "h-full relative overflow-hidden",
                plan.popular 
                  ? "bg-[var(--surface-card)] border-[var(--brand-primary)] shadow-xl shadow-[var(--brand-primary)]/10" 
                  : "bg-[var(--surface-dark)] border-[var(--surface-border)]"
              )}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-[var(--brand-primary)] text-[var(--surface-dark)] text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-heading">
                    {plan.name}
                  </h3>
                  <p className="text-[var(--text-muted)] text-sm mb-6">{plan.description}</p>

                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-[var(--text-primary)] font-heading">
                      ${isYearly ? plan.price.yearly : plan.price.monthly}
                    </span>
                    <span className="text-[var(--text-muted)]">/month</span>
                    {isYearly && plan.price.yearly > 0 && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Billed annually (${plan.price.yearly * 12}/year)
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, fi) => (
                      <li key={fi} className="flex items-start gap-3">
                        <Check
                          size={18}
                          className={cn(
                            "flex-shrink-0 mt-0.5",
                            plan.popular ? "text-[var(--brand-primary)]" : "text-[var(--success)]"
                          )}
                        />
                        <span className="text-[var(--text-secondary)] text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    asChild 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    <Link href="/signup">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// FAQ SECTION
// ============================================
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How does AutoCoach generate quizzes?",
      answer:
        "AutoCoach uses advanced AI (powered by Kimi K2.5 and GPT-4) to analyze your uploaded documents, extract key concepts, and generate relevant quiz questions. The AI understands context and creates questions that test different levels of understanding.",
    },
    {
      question: "What file formats are supported?",
      answer:
        "Currently, AutoCoach supports PDF and PowerPoint (PPTX) files. We extract text, process it into semantic chunks, and use embeddings to create a searchable knowledge base for quiz generation.",
    },
    {
      question: "How accurate is the answer evaluation?",
      answer:
        "For multiple choice and true/false questions, answers are evaluated with 100% accuracy. For free-text responses, our AI uses semantic evaluation to understand the meaning of your answer, not just exact word matches, achieving over 95% accuracy.",
    },
    {
      question: "Can I use AutoCoach offline?",
      answer:
        "AutoCoach requires an internet connection to generate quizzes and evaluate answers as it relies on cloud-based AI services. However, we're exploring offline features for future releases.",
    },
    {
      question: "Is my data secure?",
      answer:
        "Yes, we take data security seriously. Your documents are stored securely using Supabase with row-level security. We never share your data with third parties, and you can delete your documents at any time.",
    },
    {
      question: "How do I cancel my subscription?",
      answer:
        "You can cancel your Pro subscription at any time from your account settings. Your access will continue until the end of your billing period. Free accounts never expire.",
    },
  ];

  return (
    <section className="section-padding relative">
      {/* Animated Background */}
      <SectionBackground variant="default" />
      <div className="mx-auto max-w-[800px] px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20">
            FAQ
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-4 font-heading">
            Frequently Asked Questions
          </h2>
          <p className="text-[var(--text-secondary)] text-lg">
            Got questions? We&apos;ve got answers.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-[var(--text-primary)] pr-4">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openIndex === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown size={20} className="text-[var(--text-muted)]" />
                  </motion.div>
                </button>
                <div className={cn(
                  "grid transition-all duration-300",
                  openIndex === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-[var(--text-secondary)] leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// FINAL CTA SECTION
// ============================================
function FinalCTASection() {
  return (
    <section
      className="section-padding relative overflow-hidden"
    >
      {/* Animated Background */}
      <SectionBackground variant="gradient" />

      <div className="relative z-10 mx-auto max-w-[800px] px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--text-primary)] mb-6 font-heading">
            Start Learning Smarter Today
          </h2>
          <p className="text-[var(--text-secondary)] text-lg mb-8 max-w-lg mx-auto">
            Join thousands of students who are already mastering their subjects with
            AI-powered quizzes.
          </p>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button size="lg" asChild className="text-lg px-8 shadow-xl shadow-[var(--brand-primary)]/20">
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </motion.div>

          <p className="mt-4 text-sm text-[var(--text-muted)]">
            No credit card required. Start learning in seconds.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================
function Footer() {
  const footerLinks = {
    product: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
      { label: "Demo", href: "#demo" },
    ],
    resources: [
      { label: "Blog", href: "#" },
      { label: "Documentation", href: "#" },
      { label: "Tutorials", href: "#" },
    ],
    company: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Careers", href: "#" },
    ],
  };

  return (
    <footer className="bg-[var(--surface-darker)] text-[var(--text-primary)] py-16 border-t border-[var(--surface-border)]">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <LogoFull size="md" className="mb-4" />
            <p className="text-[var(--text-muted)] text-sm mb-6 max-w-xs">
              Transform your documents into interactive learning experiences with
              AI-powered quizzes.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center transition-colors"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--brand-primary)]/20 flex items-center justify-center transition-colors"
              >
                <Github size={18} />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4 text-[var(--text-primary)]">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-semibold mb-4 text-[var(--text-primary)]">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4 text-[var(--text-primary)]">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold mb-4 text-[var(--text-primary)]">Stay Updated</h4>
            <p className="text-[var(--text-muted)] text-sm mb-4">
              Get tips and updates delivered to your inbox.
            </p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[var(--brand-primary)]"
              />
              <Button type="submit" size="sm">
                Join
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[var(--surface-border)] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[var(--text-muted)] text-sm">
            © 2026 AutoCoach. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-dark)] text-[var(--text-primary)] overflow-x-hidden">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DemoSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
      
      {/* Floating Mascot Guide */}
      <MascotGuide enabled={true} />
    </div>
  );
}
