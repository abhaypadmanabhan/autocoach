"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { School, Check, X, Award, ArrowRight } from "lucide-react";

export default function Feedback() {
  const router = useRouter();
  const isCorrect = true;
  
  return (
    <div className="bg-background-light dark:bg-background-dark text-space-indigo dark:text-white min-h-screen flex flex-col items-center py-10 px-4 md:px-10 gap-8">
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full flex justify-between items-center max-w-[960px]"
      >
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 font-bold text-xl cursor-pointer"
          onClick={() => router.push("/dashboard")}
        >
          <School className="text-primary" size={24} /> AutoCoach
        </motion.div>
        <span className="text-sm font-semibold text-primary uppercase tracking-wider">In Progress</span>
      </motion.header>
      
      {/* Feedback Card */}
      <motion.section 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-[800px] flex flex-col gap-6"
      >
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 mb-2"
        >
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, delay: 0.4 }}
            className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
              isCorrect ? "bg-success/10 text-success" : "bg-error/10 text-error"
            }`}
          >
            Previous Question
          </motion.span>
        </motion.div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Progress */}
          <div className="p-6 pb-2">
            <div className="flex gap-6 justify-between mb-3 items-end">
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Question 4 of 10</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "40%" }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="bg-primary h-1.5 rounded-full"
              />
            </div>
          </div>

          {/* Question */}
          <div className="px-6 py-4">
            <h2 className="text-2xl font-bold text-space-indigo dark:text-white leading-tight">
              Which algorithm is best suited for image classification?
            </h2>
          </div>

          {/* Answer */}
          <div className="px-6 py-2 flex flex-col gap-3">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="relative flex items-center gap-4 rounded-xl border-2 border-success bg-success-light/30 p-4 shadow-sm"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, delay: 0.7 }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white"
              >
                <Check size={16} />
              </motion.div>
              <div className="flex flex-col">
                <span className="text-space-indigo dark:text-white font-bold">Convolutional Neural Networks (CNN)</span>
              </div>
            </motion.div>
          </div>

          {/* Feedback Area */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className={`border-t p-6 mt-4 ${
              isCorrect 
                ? "bg-success-light/40 border-success/20" 
                : "bg-error-light/40 border-error/20"
            }`}
          >
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <motion.h3 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className={`text-xl font-bold flex items-center gap-2 ${
                      isCorrect ? "text-success" : "text-error"
                    }`}
                  >
                    {isCorrect ? <Check size={24} /> : <X size={24} />}
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </motion.h3>
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, delay: 0.9 }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20"
                  >
                    +10 XP
                  </motion.div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {isCorrect 
                    ? "Spot on! CNNs are specifically designed to process pixel data effectively. They use convolutional layers to detect features like edges and textures."
                    : "Not quite. CNNs are the standard for image classification because they can detect spatial hierarchies of features."
                  }
                </p>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -10px rgba(205, 119, 106, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/results")}
                className="shrink-0 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-primary/20"
              >
                <span>Next Question</span>
                <ArrowRight size={20} />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
