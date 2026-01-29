"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  School, 
  PlusCircle, 
  LayoutDashboard, 
  Library,
  Flame,
  FileText,
  Play,
  LogOut,
  Loader2,
  Award
} from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { createBrowserClient } from "@/lib/supabase/client";

export default function Dashboard() {
  const router = useRouter();
  const { documents, loading, error, refetch } = useDocuments();
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Get current user
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setUserLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Calculate stats from real data
  const totalSessions = documents.length;
  const readyDocuments = documents.filter((d) => d.status === "ready").length;
  const avgScore = documents.length > 0 ? 84 : 0; // Placeholder for now

  // Get most recent ready document for "Continue Learning"
  const recentDocument = documents.find((d) => d.status === "ready");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading || userLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background-light">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white h-screen overflow-hidden flex font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-64 bg-indigo-space flex flex-col h-full shrink-0"
      >
        <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
              <School className="text-white" size={24} />
            </div>
            <h1 className="text-white text-lg font-bold tracking-tight">AutoCoach</h1>
          </motion.div>
        </div>
        
        <div className="px-4 py-6 flex flex-col gap-2">
          <Link 
            href="/upload" 
            className="w-full bg-primary hover:bg-primary-dark text-white h-12 rounded-lg font-semibold flex items-center justify-center gap-2 mb-4 transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            <PlusCircle size={20} />
            <span>Study New</span>
          </Link>
          
          <motion.div whileHover={{ x: 4 }} className="transition-all">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/10 text-white font-medium transition-all"
            >
              <LayoutDashboard size={22} />
              <span>Dashboard</span>
            </Link>
          </motion.div>
          
          <motion.div whileHover={{ x: 4 }} className="transition-all">
            <Link 
              href="#" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 font-medium transition-all"
            >
              <Library size={22} />
              <span>My Library</span>
            </Link>
          </motion.div>
        </div>

        {/* Recent Documents */}
        <div className="flex-1 overflow-y-auto px-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 px-3">Recent Documents</p>
          <div className="space-y-1">
            {documents.slice(0, 5).map((doc) => (
              <motion.div key={doc.id} whileHover={{ x: 4 }}>
                <Link 
                  href={`/analytics?document_id=${doc.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 text-sm transition-all truncate"
                >
                  <FileText size={16} />
                  <span className="truncate">{doc.filename}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-white truncate">{user?.email?.split("@")[0] || "User"}</span>
              <span className="text-xs text-slate-400 truncate">{user?.email || ""}</span>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </motion.button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative h-full">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-8"
        >
          {/* Header */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4"
          >
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight"
              >
                Welcome back, {user?.email?.split("@")[0] || "User"}
              </motion.h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Here&apos;s what&apos;s happening with your learning today.
              </p>
            </div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border border-slate-100 dark:border-slate-700"
            >
              <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-full">
                <Flame className="text-orange-500 dark:text-orange-400" size={20} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold text-slate-900 dark:text-white">5 Day Streak</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div 
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Total Sessions */}
            <motion.div 
              whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(205, 119, 106, 0.2)" }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-40"
            >
              <div className="flex justify-between items-start">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <School size={24} />
                </div>
              </div>
              <div>
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="block text-3xl font-bold text-slate-900 dark:text-white mb-1"
                >
                  {totalSessions}
                </motion.span>
                <span className="text-slate-500 text-sm font-medium">Total Documents</span>
              </div>
            </motion.div>

            {/* Average Score */}
            <motion.div 
              whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(205, 119, 106, 0.2)" }}
              transition={{ duration: 0.3 }}
              onClick={() => router.push("/analytics")}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between h-40 relative overflow-hidden cursor-pointer"
            >
              <div className="flex flex-col gap-1 z-10">
                <span className="text-slate-500 text-sm font-medium">Ready Documents</span>
                <motion.span 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  className="text-4xl font-bold text-slate-900 dark:text-white"
                >
                  {readyDocuments}
                </motion.span>
              </div>
              <div className="relative size-24 flex-shrink-0">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  <path 
                    className="text-slate-100 dark:text-slate-700" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3"
                  />
                  <motion.path 
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: `${totalSessions > 0 ? (readyDocuments / totalSessions) * 100 : 0}, 100` }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                    className="text-primary" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeLinecap="round" 
                    strokeWidth="3"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Award className="text-primary" size={28} />
                </div>
              </div>
            </motion.div>

            {/* Documents */}
            <motion.div 
              whileHover={{ y: -4, boxShadow: "0 12px 24px -8px rgba(205, 119, 106, 0.2)" }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-40"
            >
              <div className="flex justify-between items-start">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                  <FileText size={24} />
                </div>
              </div>
              <div>
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="block text-3xl font-bold text-slate-900 dark:text-white mb-1"
                >
                  {documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)}
                </motion.span>
                <span className="text-slate-500 text-sm font-medium">Total Chunks</span>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Continue Learning */}
          {recentDocument && (
            <motion.div 
              variants={itemVariants}
              whileHover={{ scale: 1.01 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-center"
            >
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-full md:w-48 h-32 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0"
              >
                <FileText className="w-16 h-16 text-primary/60" />
              </motion.div>
              <div className="flex-1 w-full">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{recentDocument.filename}</h3>
                <p className="text-slate-500 text-sm mb-4">
                  {recentDocument.status === "ready" ? "Ready to study" : recentDocument.status}
                  {recentDocument.chunk_count && ` • ${recentDocument.chunk_count} chunks`}
                </p>
                <div className="flex items-center gap-4">
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: recentDocument.status === "ready" ? "100%" : "60%" }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  <span className="text-sm font-bold text-primary whitespace-nowrap">
                    {recentDocument.status === "ready" ? "100%" : "60%"}
                  </span>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/config?document_id=${recentDocument.id}`)}
                className="w-full md:w-auto px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
              >
                <span>Start Quiz</span>
                <Play size={18} />
              </motion.button>
            </motion.div>
          )}

          {/* Documents List */}
          {documents.length > 0 && (
            <motion.div variants={itemVariants}>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Your Documents</h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                {documents.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    whileHover={{ backgroundColor: "rgba(205, 119, 106, 0.05)" }}
                    onClick={() => router.push(`/analytics?document_id=${doc.id}`)}
                    className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{doc.filename}</p>
                        <p className="text-sm text-slate-500">
                          {(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.status === "ready" ? "bg-green-100 text-green-700" :
                        doc.status === "processing" ? "bg-yellow-100 text-yellow-700" :
                        doc.status === "pending" ? "bg-gray-100 text-gray-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {doc.status}
                      </span>
                      {doc.status === "ready" && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/config?document_id=${doc.id}`);
                          }}
                          className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-all"
                        >
                          Quiz
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
              Error loading documents: {error}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
