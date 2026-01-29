"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { School, PlayCircle, Sparkles, LogIn } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background-light text-indigo-space overflow-x-hidden">
      {/* Top Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100"
      >
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-indigo-space">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <School size={24} />
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-black tracking-tight text-indigo-space"
              >
                AutoCoach
              </motion.h2>
            </Link>
            <div className="hidden md:flex flex-1 items-center justify-end gap-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-6"
              >
                <motion.a 
                  whileHover={{ scale: 1.05, color: "#cd776a" }}
                  className="text-sm font-medium text-indigo-space-light transition-colors"
                  href="#features"
                >
                  Features
                </motion.a>
                <motion.a 
                  whileHover={{ scale: 1.05, color: "#cd776a" }}
                  className="text-sm font-medium text-indigo-space-light transition-colors"
                  href="#pricing"
                >
                  Pricing
                </motion.a>
              </motion.div>
              
              {/* Auth Buttons */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3"
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
                  className="flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark transition-all px-5 py-2 text-white text-sm font-bold shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
                >
                  Sign Up
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <div className="relative w-full overflow-hidden bg-background-light pt-12 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="flex flex-col items-start gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
              >
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex h-1.5 w-1.5 rounded-full bg-primary mr-2"
                />
                AI-Powered Learning
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-4xl font-black leading-tight tracking-tight text-indigo-space lg:text-6xl"
              >
                Master Any Topic with{" "}
                <span className="gradient-text">AI-Generated</span> Quizzes
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-slate-600 leading-relaxed max-w-lg"
              >
                Turn your documents, notes, and lectures into interactive learning experiences instantly. AutoCoach adapts to your learning pace.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-2"
              >
                {/* Create Your First Quiz - Goes to Signup for new users */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link 
                    href="/signup" 
                    className="flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark transition-all duration-300 px-6 py-3.5 text-white text-base font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 w-full sm:w-auto"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Your First Quiz
                  </Link>
                </motion.div>
                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: "#f9fafb" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center rounded-lg bg-white border border-gray-200 text-indigo-space px-6 py-3.5 text-base font-medium w-full sm:w-auto transition-all"
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Watch Demo
                </motion.button>
              </motion.div>

              {/* Trust indicators */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-6 mt-4 text-sm text-slate-text"
              >
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Free forever plan</span>
                </div>
              </motion.div>
            </div>

            {/* Right Content - Hero Image */}
            <motion.div 
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative lg:h-auto w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#f8f6f6] to-[#eaddd8] overflow-hidden shadow-2xl border border-gray-100"
            >
              {/* Animated background dots */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ duration: 1 }}
                className="absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(#cd776a 1px, transparent 1px)",
                  backgroundSize: "24px 24px"
                }}
              />
              
              {/* Floating decorative elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-10 right-10 w-20 h-20 bg-primary/20 rounded-full blur-xl"
              />
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-10 left-10 w-16 h-16 bg-orange-400/20 rounded-full blur-xl"
              />
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="absolute inset-4 rounded-xl overflow-hidden shadow-inner bg-white"
              >
                <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-primary/10 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                    className="text-center"
                  >
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <School className="w-24 h-24 text-primary/40 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-slate-500 font-medium">Your Learning Journey Starts Here</p>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-indigo-space mb-4">How It Works</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Three simple steps to transform your learning experience
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[{
              step: "01",
              title: "Upload",
              desc: "Upload your PDF or PPTX documents",
              icon: "📄"
            }, {
              step: "02",
              title: "Generate",
              desc: "AI creates personalized quiz questions",
              icon: "✨"
            }, {
              step: "03",
              title: "Learn",
              desc: "Practice with interactive sessions",
              icon: "🎯"
            }].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="bg-background-light rounded-2xl p-8 text-center card-glow cursor-pointer"
              >
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="text-4xl mb-4"
                >
                  {item.icon}
                </motion.div>
                <span className="text-primary font-bold text-sm">{item.step}</span>
                <h3 className="text-xl font-bold text-indigo-space mt-2 mb-3">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-background-light">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-indigo-space mb-6">
              Ready to Start Learning Smarter?
            </h2>
            <p className="text-slate-600 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of students who are already using AutoCoach to master their subjects.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link 
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary-dark transition-all duration-300 px-8 py-4 text-white text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-xl"
              >
                Get Started Free
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-beige-footer py-12 border-t border-slate-border">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <School size={20} />
              </div>
              <span className="font-bold text-indigo-space">AutoCoach</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/login" className="text-sm text-slate-text hover:text-primary transition-colors">
                Log In
              </Link>
              <Link href="/signup" className="text-sm text-slate-text hover:text-primary transition-colors">
                Sign Up
              </Link>
            </div>
            <p className="text-slate-text text-sm">
              © 2026 AutoCoach. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
