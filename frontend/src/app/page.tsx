"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import Link from "next/link";
import {
  School,
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
} from "lucide-react";

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
    window.addEventListener("scroll", handleScroll);
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "glass-nav shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="flex h-16 lg:h-20 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 text-indigo-space">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
              >
                <School size={22} />
              </motion.div>
              <h2 className="text-xl font-extrabold tracking-tight text-indigo-space font-heading">
                AutoCoach
              </h2>
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
                    className="nav-link text-sm font-medium text-indigo-space-light hover:text-indigo-space transition-colors"
                  >
                    {link.label}
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
              <Link
                href="/login"
                className="flex items-center justify-center rounded-lg border border-slate-border hover:bg-gray-50 transition-all px-4 py-2 text-indigo-space text-sm font-medium"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Log In
              </Link>
              <Link
                href="/signup"
                className="flex items-center justify-center rounded-xl bg-primary hover:bg-primary-dark transition-all px-5 py-2.5 text-white text-sm font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
              >
                Sign Up
              </Link>
            </motion.div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={24} className="text-indigo-space" />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`mobile-menu-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Menu Panel */}
      <div className={`mobile-menu-panel ${mobileMenuOpen ? "open" : ""}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <School size={20} />
              </div>
              <span className="font-bold text-indigo-space font-heading">AutoCoach</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={24} className="text-indigo-space" />
            </button>
          </div>

          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-indigo-space hover:text-primary transition-colors py-2"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-slate-border flex flex-col gap-3">
            <Link
              href="/login"
              className="flex items-center justify-center rounded-lg border border-slate-border hover:bg-gray-50 transition-all px-4 py-3 text-indigo-space font-medium"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Log In
            </Link>
            <Link
              href="/signup"
              className="flex items-center justify-center rounded-xl bg-primary hover:bg-primary-dark transition-all px-5 py-3 text-white font-bold"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// HERO SECTION
// ============================================
function HeroSection() {
  return (
    <section className="relative min-h-screen pt-24 lg:pt-32 pb-16 lg:pb-24 overflow-hidden gradient-mesh noise-bg">
      {/* Floating decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl float-slow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.div
          className="absolute top-40 right-20 w-48 h-48 bg-orange-400/10 rounded-full blur-3xl float-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        />
        <motion.div
          className="absolute bottom-20 left-1/3 w-56 h-56 bg-primary/5 rounded-full blur-3xl float-fast"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="flex flex-col items-start gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center rounded-full border border-primary/20 bg-white/80 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-primary shadow-sm"
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex h-2 w-2 rounded-full bg-primary mr-2"
              />
              AI-Powered Learning Platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-indigo-space font-heading"
            >
              Master Any Topic with{" "}
              <span className="gradient-text">AI-Generated</span> Quizzes
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg lg:text-xl text-slate-600 leading-relaxed max-w-lg"
            >
              Transform your documents, notes, and lectures into interactive learning
              experiences. AutoCoach adapts to your pace and helps you retain more.
            </motion.p>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="flex flex-wrap items-center gap-6 text-sm text-slate-text"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-orange-400/20 border-2 border-white flex items-center justify-center text-xs font-medium text-primary"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <span className="font-medium text-indigo-space">10,000+ students</span>
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
                <span className="font-medium text-indigo-space">98% satisfaction</span>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-2"
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/signup"
                  className="flex items-center justify-center rounded-xl bg-primary hover:bg-primary-dark transition-all duration-300 px-7 py-4 text-white text-base font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 w-full sm:w-auto pulse-cta"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Your First Quiz
                </Link>
              </motion.div>
              <motion.a
                href="#demo"
                whileHover={{ scale: 1.02, backgroundColor: "#ffffff" }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 text-indigo-space px-6 py-4 text-base font-medium w-full sm:w-auto transition-all shadow-sm hover:shadow-md"
              >
                <PlayCircle className="w-5 h-5 mr-2" />
                Watch Demo
              </motion.a>
            </motion.div>
          </div>

          {/* Right Content - App Preview */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="demo-window">
              <div className="demo-window-header">
                <div className="demo-window-dot red" />
                <div className="demo-window-dot yellow" />
                <div className="demo-window-dot green" />
                <span className="ml-4 text-xs text-gray-500 font-medium">
                  AutoCoach Dashboard
                </span>
              </div>
              <div className="p-6 bg-gradient-to-br from-background-light to-white min-h-[320px] lg:min-h-[400px]">
                {/* Mock Quiz Interface */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-indigo-space">
                          Machine Learning Basics
                        </p>
                        <p className="text-xs text-slate-text">12 questions</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                      In Progress
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-slate-border/50 shadow-sm">
                    <p className="text-xs text-primary font-medium mb-2">
                      Question 3 of 12
                    </p>
                    <p className="text-sm font-medium text-indigo-space mb-4">
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
                          className={`p-3 rounded-lg border text-sm cursor-pointer transition-all ${
                            i === 0
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-slate-border/50 text-slate-600 hover:border-primary/30"
                          }`}
                        >
                          {option}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-slate-border/30 overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: "25%" }}
                          transition={{ duration: 1, delay: 0.8 }}
                        />
                      </div>
                      <span className="text-xs text-slate-text">25%</span>
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Submit Answer
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating annotation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="absolute -bottom-4 -left-4 lg:-left-8 bg-white rounded-xl p-3 shadow-lg border border-slate-border/50"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                  <Check size={16} className="text-success" />
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-space">
                    Instant Feedback
                  </p>
                  <p className="text-xs text-slate-text">AI evaluates your answers</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// FEATURES SECTION (6 Cards)
// ============================================
function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

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
    <section id="features" className="section-padding bg-white noise-bg" ref={ref}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-space mb-4 font-heading">
            Everything You Need to Learn Smarter
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Powerful features designed to transform how you study and retain information
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="card-glow-border p-6 lg:p-8"
            >
              <div className="feature-icon mb-5">
                <feature.icon size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-indigo-space mb-3 font-heading">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// HOW IT WORKS SECTION (3 Steps)
// ============================================
function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

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
      className="section-padding bg-gradient-to-b from-background-light to-white"
      ref={ref}
    >
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-space mb-4 font-heading">
            Three Simple Steps to Success
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Get started in minutes and transform your learning experience
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-24 left-[16.67%] right-[16.67%] h-0.5">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full bg-gradient-to-r from-primary via-primary to-primary/30 origin-left"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
                className="relative text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border-2 border-primary/20 shadow-lg shadow-primary/10 mb-6 z-10"
                >
                  <step.icon size={32} className="text-primary" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </motion.div>
                <h3 className="text-xl font-bold text-indigo-space mb-3 font-heading">
                  {step.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
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
      className="section-padding bg-indigo-space text-white relative overflow-hidden"
      ref={ref}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-orange-400 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-4">
            See It In Action
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 font-heading">
            Watch AutoCoach Work Its Magic
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto text-lg">
            From document upload to quiz mastery in seconds
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Demo Window */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="demo-window"
          >
            <div className="demo-window-header">
              <div className="demo-window-dot red" />
              <div className="demo-window-dot yellow" />
              <div className="demo-window-dot green" />
              <span className="ml-4 text-xs text-gray-500 font-medium">AutoCoach</span>
            </div>
            <div className="p-6 bg-white min-h-[300px] flex items-center justify-center">
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
                      className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center"
                    >
                      <Upload size={32} className="text-primary" />
                    </motion.div>
                    <p className="text-indigo-space font-medium mb-2">
                      Uploading document...
                    </p>
                    <div className="w-48 h-2 mx-auto rounded-full bg-slate-border/30 overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
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
                      <Loader2 size={64} className="text-primary" />
                    </motion.div>
                    <p className="text-indigo-space font-medium mb-2">
                      AI is analyzing content...
                    </p>
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="flex justify-center gap-1"
                    >
                      <Sparkles size={16} className="text-primary" />
                      <Sparkles size={16} className="text-orange-400" />
                      <Sparkles size={16} className="text-primary" />
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
                    <p className="text-xs text-primary font-medium mb-2">
                      Question 1 of 10
                    </p>
                    <p className="text-sm font-medium text-indigo-space mb-4">
                      What is the capital of France?
                    </p>
                    <div className="space-y-2">
                      {["Paris", "London", "Berlin", "Madrid"].map((opt, i) => (
                        <motion.div
                          key={opt}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.15 }}
                          className="p-3 rounded-lg border border-slate-border/50 text-sm text-slate-600"
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
                    <p className="text-xs text-primary font-medium mb-2">
                      Question 1 of 10
                    </p>
                    <p className="text-sm font-medium text-indigo-space mb-4">
                      What is the capital of France?
                    </p>
                    <div className="space-y-2">
                      {["Paris", "London", "Berlin", "Madrid"].map((opt, i) => (
                        <div
                          key={opt}
                          className={`p-3 rounded-lg border text-sm transition-all ${
                            i === 0
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-slate-border/50 text-slate-600"
                          }`}
                        >
                          {opt}
                          {i === 0 && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="float-right"
                            >
                              <Check size={16} className="text-primary" />
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
                      className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center"
                    >
                      <Check size={40} className="text-success" />
                    </motion.div>
                    <p className="text-xl font-bold text-success mb-2">Correct!</p>
                    <p className="text-slate-600 text-sm mb-4">
                      Paris is the capital of France.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-slate-text">Score:</span>
                      <span className="font-bold text-indigo-space">1/1</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Stage Descriptions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
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
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    stage === i ? "bg-primary text-white" : "bg-white/10 text-white/50"
                  }`}
                >
                  {i + 1}
                </div>
                <div>
                  <h4
                    className={`font-bold mb-1 transition-colors ${
                      stage === i ? "text-white" : "text-white/50"
                    }`}
                  >
                    {s.name}
                  </h4>
                  <p className={`text-sm ${stage === i ? "text-white/70" : "text-white/30"}`}>
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
                <div
                  key={i}
                  className={`stage-dot ${stage === i ? "active" : ""}`}
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

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
    <section id="testimonials" className="section-padding bg-background-light" ref={ref}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-space mb-4 font-heading">
            Loved by Students Everywhere
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Join thousands of learners who have transformed their study habits
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="testimonial-card"
            >
              <div className="flex mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className="text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4 italic">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-border/30">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-orange-400/20 flex items-center justify-center text-sm font-bold text-primary">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-indigo-space text-sm">
                    {testimonial.name}
                  </p>
                  <p className="text-slate-text text-xs">{testimonial.role}</p>
                </div>
              </div>
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
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
    <section id="pricing" className="section-padding bg-white" ref={ref}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-space mb-4 font-heading">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg mb-8">
            Choose the plan that fits your learning journey
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-sm font-medium ${
                !isYearly ? "text-indigo-space" : "text-slate-text"
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-7 rounded-full bg-primary/20 transition-colors"
            >
              <motion.div
                animate={{ x: isYearly ? 26 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-primary"
              />
            </button>
            <span
              className={`text-sm font-medium ${
                isYearly ? "text-indigo-space" : "text-slate-text"
              }`}
            >
              Yearly{" "}
              <span className="text-success text-xs font-bold">Save 22%</span>
            </span>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? "bg-white border-2 border-primary shadow-xl shadow-primary/10 pricing-popular"
                  : "bg-background-light border border-slate-border/50"
              }`}
            >
              <h3 className="text-xl font-bold text-indigo-space mb-2 font-heading">
                {plan.name}
              </h3>
              <p className="text-slate-text text-sm mb-6">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-extrabold text-indigo-space font-heading">
                  ${isYearly ? plan.price.yearly : plan.price.monthly}
                </span>
                <span className="text-slate-text">/month</span>
                {isYearly && plan.price.yearly > 0 && (
                  <p className="text-xs text-slate-text mt-1">
                    Billed annually (${plan.price.yearly * 12}/year)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start gap-3">
                    <Check
                      size={18}
                      className={`flex-shrink-0 mt-0.5 ${
                        plan.popular ? "text-primary" : "text-success"
                      }`}
                    />
                    <span className="text-slate-600 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full text-center py-3 rounded-xl font-bold transition-all ${
                  plan.popular
                    ? "bg-primary hover:bg-primary-dark text-white shadow-md shadow-primary/20 hover:shadow-lg"
                    : "bg-white border border-slate-border hover:border-primary text-indigo-space"
                }`}
              >
                {plan.cta}
              </Link>
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
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
    <section className="section-padding bg-background-light" ref={ref}>
      <div className="mx-auto max-w-[800px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-space mb-4 font-heading">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-lg">
            Got questions? We&apos;ve got answers.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="bg-white rounded-xl border border-slate-border/50 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-semibold text-indigo-space pr-4">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown size={20} className="text-slate-text" />
                </motion.div>
              </button>
              <div className={`accordion-content ${openIndex === i ? "open" : ""}`}>
                <div>
                  <p className="px-5 pb-5 text-slate-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      className="section-padding relative overflow-hidden"
      ref={ref}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background-light to-orange-400/10" />

      {/* Floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl float-slow" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-orange-400/10 rounded-full blur-2xl float-medium" />
      </div>

      <div className="relative z-10 mx-auto max-w-[800px] px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-indigo-space mb-6 font-heading">
            Start Learning Smarter Today
          </h2>
          <p className="text-slate-600 text-lg mb-8 max-w-lg mx-auto">
            Join thousands of students who are already mastering their subjects with
            AI-powered quizzes.
          </p>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block"
          >
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary-dark transition-all duration-300 px-8 py-4 text-white text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </motion.div>

          <p className="mt-4 text-sm text-slate-text">
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
    <footer className="bg-indigo-space text-white py-16">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                <School size={22} />
              </div>
              <span className="text-xl font-bold font-heading">AutoCoach</span>
            </div>
            <p className="text-white/60 text-sm mb-6 max-w-xs">
              Transform your documents into interactive learning experiences with
              AI-powered quizzes.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <Github size={18} />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold mb-4">Stay Updated</h4>
            <p className="text-white/60 text-sm mb-4">
              Get tips and updates delivered to your inbox.
            </p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-colors"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © 2026 AutoCoach. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">
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
    <div className="min-h-screen bg-background-light text-indigo-space overflow-x-hidden">
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
    </div>
  );
}
