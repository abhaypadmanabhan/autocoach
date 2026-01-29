"use client";

import { Suspense, useEffect, useState, useRef, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { School, X, Loader2, Sparkles, Check, Clock } from "lucide-react";
import { useCreateSession } from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import type { Difficulty, QuestionType } from "@/lib/types";

type Step = "welcome" | "questions" | "difficulty" | "types" | "timer" | "summary";

interface ChatMessage {
  id: string;
  role: "agent" | "user";
  content: React.ReactNode;
  step?: Step;
}

const QUICK_QUESTIONS = [5, 10, 15, 20];
const DIFFICULTIES: { value: Difficulty; label: string; emoji: string }[] = [
  { value: "easy", label: "Easy", emoji: "🌱" },
  { value: "medium", label: "Medium", emoji: "🌿" },
  { value: "hard", label: "Hard", emoji: "🔥" },
];
const QUESTION_TYPES: { value: QuestionType; label: string; emoji: string }[] = [
  { value: "mcq", label: "Multiple Choice", emoji: "🔘" },
  { value: "true_false", label: "True / False", emoji: "✓" },
  { value: "free_text", label: "Free Text", emoji: "✏️" },
];
const TIMER_OPTIONS: { value: number | null; label: string; seconds: number }[] = [
  { value: 60, label: "1 min", seconds: 60 },
  { value: 180, label: "3 min", seconds: 180 },
  { value: 300, label: "5 min", seconds: 300 },
  { value: 600, label: "10 min", seconds: 600 },
  { value: null, label: "No timer", seconds: 0 },
];

function ConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const { document, loading: docLoading } = useDocument(documentId);
  const { createSession, creating, error: sessionError } = useCreateSession();

  // Quiz configuration state
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["mcq", "true_false", "free_text"]);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [customQuestionInput, setCustomQuestionInput] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Message ID counter for stable IDs without Date.now() during render
  const messageIdCounter = useRef(0);
  const getNextMessageId = () => {
    messageIdCounter.current += 1;
    return `msg-${messageIdCounter.current}`;
  };

  // Chat state - lazily initialized to avoid setState in effect
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Initial welcome message
    return [
      {
        id: "welcome",
        role: "agent",
        content: null, // Will be populated after document loads
      }
    ];
  });
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [isTyping, setIsTyping] = useState(false);

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!documentId) {
      router.push("/upload");
    }
  }, [documentId, router]);

  // Initialize chat messages after document loads
  // Using ref to track initialization without triggering re-renders
  const initStartedRef = useRef(false);
  
  useEffect(() => {
    if (docLoading || initStartedRef.current) return;
    initStartedRef.current = true;
    
    // Update welcome message with document name
    // Using startTransition to mark this as a non-urgent update
    startTransition(() => {
      const welcomeMsg: ChatMessage = {
        id: "welcome",
        role: "agent",
        content: (
          <div className="space-y-2">
            <p className="text-[#f2f5de]">
              Hi! I&apos;m your AutoCoach Quiz Agent. 🎯
            </p>
            <p className="text-[#f2f5de]/80">
              I&apos;ll help you set up the perfect quiz{document ? ` for "${document.filename}"` : ""}.
              Let&apos;s start with the basics!
            </p>
          </div>
        ),
      };
      setMessages([welcomeMsg]);
    });
    
    // Show first question after a brief delay
    const timeout = setTimeout(() => {
      messageIdCounter.current += 1;
      const questionMessage: ChatMessage = {
        id: getNextMessageId(),
        role: "agent",
        content: (
          <div>
            <p className="text-[#f2f5de] font-medium mb-1">How many questions would you like?</p>
            <p className="text-[#f2f5de]/60 text-sm">Choose a quick option or set a custom number (3-50)</p>
          </div>
        ),
        step: "questions",
      };
      setMessages(prevMessages => [...prevMessages, questionMessage]);
      setCurrentStep("questions");
    }, 600);

    return () => clearTimeout(timeout);
  }, [docLoading, document]);

  const addAgentMessage = (step: Step, content: React.ReactNode) => {
    setIsTyping(true);
    const timeout = setTimeout(() => {
      const newMessage: ChatMessage = {
        id: getNextMessageId(),
        role: "agent",
        content,
        step,
      };
      setMessages(prev => [...prev, newMessage]);
      setCurrentStep(step);
      setIsTyping(false);
    }, 400);
    return () => clearTimeout(timeout);
  };

  const addUserMessage = (content: React.ReactNode) => {
    const newMessage: ChatMessage = {
      id: getNextMessageId(),
      role: "user",
      content,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleQuestionCount = (count: number) => {
    setNumQuestions(count);
    addUserMessage(<span className="font-medium">{count} questions</span>);
    setShowCustomInput(false);
    
    setTimeout(() => {
      addAgentMessage("difficulty", (
        <div>
          <p className="text-[#f2f5de] font-medium mb-1">Great choice! What difficulty level?</p>
          <p className="text-[#f2f5de]/60 text-sm">This affects how challenging the questions will be</p>
        </div>
      ));
    }, 300);
  };

  const handleCustomQuestionSubmit = () => {
    const count = parseInt(customQuestionInput, 10);
    if (count >= 3 && count <= 50) {
      handleQuestionCount(count);
    }
  };

  const handleDifficulty = (level: Difficulty) => {
    setDifficulty(level);
    const diffLabel = DIFFICULTIES.find(d => d.value === level);
    addUserMessage(
      <span className="font-medium">{diffLabel?.emoji} {diffLabel?.label}</span>
    );
    
    setTimeout(() => {
      addAgentMessage("types", (
        <div>
          <p className="text-[#f2f5de] font-medium mb-1">What types of questions should I include?</p>
          <p className="text-[#f2f5de]/60 text-sm">Tap to toggle each type (all are selected by default)</p>
        </div>
      ));
    }, 300);
  };

  const toggleQuestionType = (type: QuestionType) => {
    setQuestionTypes(prev => {
      const newTypes = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type];
      return newTypes;
    });
  };

  const handleTypesConfirm = () => {
    if (questionTypes.length === 0) return;
    
    const typeLabels = questionTypes.map(t => 
      QUESTION_TYPES.find(qt => qt.value === t)?.label
    ).join(", ");
    
    addUserMessage(<span className="font-medium">{typeLabels}</span>);
    
    setTimeout(() => {
      addAgentMessage("timer", (
        <div>
          <p className="text-[#f2f5de] font-medium mb-1">Would you like a time limit?</p>
          <p className="text-[#f2f5de]/60 text-sm">This adds some excitement! Choose &quot;No timer&quot; for a relaxed pace</p>
        </div>
      ));
    }, 300);
  };

  const handleTimer = (seconds: number | null) => {
    setTimerSeconds(seconds);
    const timerLabel = TIMER_OPTIONS.find(t => t.value === seconds)?.label;
    addUserMessage(
      <span className="font-medium flex items-center gap-2">
        {seconds ? <Clock size={16} /> : null}
        {timerLabel}
      </span>
    );
    
    setTimeout(() => {
      addAgentMessage("summary", (
        <div className="space-y-3">
          <p className="text-[#f2f5de] font-medium">Perfect! Here&apos;s your quiz setup:</p>
          <div className="bg-[#34344a]/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#f2f5de]/60">Questions:</span>
              <span className="text-[#f2f5de] font-medium">{numQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#f2f5de]/60">Difficulty:</span>
              <span className="text-[#f2f5de] font-medium capitalize">{difficulty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#f2f5de]/60">Types:</span>
              <span className="text-[#f2f5de] font-medium">{questionTypes.length} selected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#f2f5de]/60">Timer:</span>
              <span className="text-[#f2f5de] font-medium">{timerSeconds ? `${Math.floor(timerSeconds / 60)} min` : "None"}</span>
            </div>
          </div>
          <p className="text-[#f2f5de]/80">Ready to start? 🚀</p>
        </div>
      ));
    }, 300);
  };

  const handleStartQuiz = async () => {
    if (!documentId || questionTypes.length === 0) return;

    try {
      const session = await createSession({
        document_id: documentId,
        num_questions: numQuestions,
        difficulty,
        question_types: questionTypes,
      });
      
      // Navigate with timer param if set
      const timerParam = timerSeconds ? `&t=${timerSeconds}` : "";
      router.push(`/session?session_id=${session.session_id}${timerParam}`);
    } catch {
      // Error handled by hook
    }
  };

  if (docLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#34344a]">
        <Loader2 className="w-8 h-8 text-[#cd776a] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#34344a] text-[#f2f5de] font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#34344a]/90 border-b border-[#495867]/50 px-6 py-4">
        <div className="max-w-[700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-[#cd776a]/20 text-[#cd776a] flex items-center justify-center">
              <School size={20} />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[#f2f5de]">AutoCoach</h2>
          </div>
          <button 
            onClick={() => router.push("/dashboard")} 
            className="flex items-center justify-center size-10 rounded-full hover:bg-[#495867]/50 transition-colors cursor-pointer"
          >
            <X className="text-[#f2f5de]/70" size={20} />
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 w-full max-w-[700px] mx-auto px-4 py-6 pb-40 overflow-y-auto">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className={`flex ${message.role === "agent" ? "justify-start" : "justify-end"}`}
              >
                {message.role === "agent" ? (
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="size-8 rounded-full bg-[#cd776a] flex items-center justify-center shrink-0">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <div className="bg-[#495867] rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#cd776a] text-[#34344a] rounded-2xl rounded-tr-sm px-4 py-3 text-sm font-medium max-w-[70%]">
                    {message.content}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="size-8 rounded-full bg-[#cd776a] flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-white" />
              </div>
              <div className="bg-[#495867] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-[#f2f5de]/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[#f2f5de]/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-[#f2f5de]/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#34344a] border-t border-[#495867]/50 px-4 py-4">
        <div className="max-w-[700px] mx-auto">
          <AnimatePresence mode="wait">
            {/* Step: Questions */}
            {currentStep === "questions" && !isTyping && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-wrap gap-2"
              >
                {QUICK_QUESTIONS.map(count => (
                  <button
                    key={count}
                    onClick={() => handleQuestionCount(count)}
                    className="px-5 py-2.5 rounded-full bg-[#495867] hover:bg-[#cd776a] text-[#f2f5de] hover:text-[#34344a] font-medium transition-all duration-200"
                  >
                    {count}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="px-5 py-2.5 rounded-full bg-[#495867]/50 hover:bg-[#495867] text-[#f2f5de]/80 hover:text-[#f2f5de] font-medium transition-all duration-200 border border-dashed border-[#f2f5de]/30"
                >
                  Custom
                </button>
              </motion.div>
            )}

            {/* Custom question input */}
            {showCustomInput && currentStep === "questions" && (
              <motion.div
                key="custom-input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={customQuestionInput}
                  onChange={(e) => setCustomQuestionInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomQuestionSubmit()}
                  placeholder="Enter number (3-50)"
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#495867] text-[#f2f5de] placeholder-[#f2f5de]/40 focus:outline-none focus:ring-2 focus:ring-[#cd776a]"
                  autoFocus
                />
                <button
                  onClick={handleCustomQuestionSubmit}
                  disabled={!customQuestionInput || parseInt(customQuestionInput) < 3 || parseInt(customQuestionInput) > 50}
                  className="px-5 py-2.5 rounded-full bg-[#cd776a] text-[#34344a] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Check size={20} />
                </button>
              </motion.div>
            )}

            {/* Step: Difficulty */}
            {currentStep === "difficulty" && !isTyping && (
              <motion.div
                key="difficulty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-wrap gap-2"
              >
                {DIFFICULTIES.map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    onClick={() => handleDifficulty(value)}
                    className={`px-5 py-2.5 rounded-full font-medium transition-all duration-200 ${
                      difficulty === value
                        ? "bg-[#cd776a] text-[#34344a]"
                        : "bg-[#495867] hover:bg-[#495867]/80 text-[#f2f5de]"
                    }`}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step: Question Types */}
            {currentStep === "types" && !isTyping && (
              <motion.div
                key="types"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(({ value, label, emoji }) => (
                    <button
                      key={value}
                      onClick={() => toggleQuestionType(value)}
                      className={`px-4 py-2.5 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
                        questionTypes.includes(value)
                          ? "bg-[#cd776a] text-[#34344a]"
                          : "bg-[#495867]/50 text-[#f2f5de]/60 hover:bg-[#495867]"
                      }`}
                    >
                      {questionTypes.includes(value) && <Check size={14} />}
                      {emoji} {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleTypesConfirm}
                  disabled={questionTypes.length === 0}
                  className="w-full py-3 rounded-xl bg-[#cd776a] text-[#34344a] font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Confirm Selection
                </button>
              </motion.div>
            )}

            {/* Step: Timer */}
            {currentStep === "timer" && !isTyping && (
              <motion.div
                key="timer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-wrap gap-2"
              >
                {TIMER_OPTIONS.map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => handleTimer(value)}
                    className={`px-5 py-2.5 rounded-full font-medium transition-all duration-200 ${
                      timerSeconds === value
                        ? "bg-[#cd776a] text-[#34344a]"
                        : "bg-[#495867] hover:bg-[#495867]/80 text-[#f2f5de]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step: Summary / Start */}
            {currentStep === "summary" && !isTyping && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {sessionError && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                    {getErrorMessage(sessionError)}
                  </div>
                )}
                <button
                  onClick={handleStartQuiz}
                  disabled={creating}
                  className="w-full py-4 rounded-xl bg-[#cd776a] text-[#34344a] font-bold text-lg shadow-lg shadow-[#cd776a]/20 hover:shadow-[#cd776a]/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Creating Quiz...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Start Quiz
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#34344a]">
        <Loader2 className="w-8 h-8 text-[#cd776a] animate-spin" />
      </div>
    }>
      <ConfigContent />
    </Suspense>
  );
}
