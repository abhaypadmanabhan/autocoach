"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { School } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background-light">
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 py-4 px-6"
      >
        <Link href="/" className="flex items-center gap-2 max-w-md mx-auto">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <School size={20} />
          </motion.div>
          <span className="text-xl font-bold text-indigo-space">AutoCoach</span>
        </Link>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-md w-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="py-6 text-center text-sm text-slate-text"
      >
        <p>© 2026 AutoCoach. All rights reserved.</p>
      </motion.footer>
    </div>
  );
}
