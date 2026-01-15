"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Menu, Plus, MessageSquare, X, ChevronDown, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

// Types
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface AIModel {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const MODELS: AIModel[] = [
  { id: "openai", name: "GPT-4o (OpenAI)", icon: "🧠", description: "Smartest model" },
  { id: "claude", name: "Claude 3.5 Sonnet", icon: "🎭", description: "Natural reasoning" },
  { id: "mistral", name: "Mistral Large", icon: "🌪️", description: "Open source power" },
  { id: "llama", name: "Llama 3.1", icon: "🦙", description: "Meta's latest" },
  { id: "qwen-coder", name: "Qwen 2.5 Coder", icon: "💻", description: "Code specialist" },
  { id: "searchgpt", name: "SearchGPT", icon: "🌐", description: "Web search" },
  { id: "deepseek", name: "DeepSeek R1", icon: "🐋", description: "Reasoning" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState("openai");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Direct call to Pollinations AI
      // In a full production app, this might go via our Python backend, but for speed we keep client-side for now.
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are Draco AI. Helpful, smart, and concise." },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: input },
          ],
          model: currentModel,
          seed: Math.floor(Math.random() * 1000),
          jsonMode: false,
        }),
      });

      if (!response.ok) throw new Error("API Error");

      const text = await response.text();
      const aiMsg: Message = { role: "assistant", content: text, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error connecting to AI. Please try again.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#0f1117] text-[#f8fafc] font-sans overflow-hidden">
      {/* Sidebar - Desktop & Mobile */}
      <AnimatePresence>
        {(sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed md:relative z-50 w-[280px] h-full bg-[#161b22] border-r border-[#2d3748] flex flex-col p-4 shadow-2xl md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
              }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent font-mono">
                <Bot className="text-indigo-500" /> Draco.AI
              </div>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 p-2 hover:bg-white/5 rounded-full">
                <X />
              </button>
            </div>

            <button
              onClick={() => { setMessages([]); setInput(""); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2 bg-[#1f242d] hover:bg-[#2d3748] border border-[#2d3748] p-3 rounded-xl text-sm font-medium transition-colors mb-4 active:scale-95 duration-200"
            >
              <Plus size={18} /> New Chat
            </button>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">History</div>
              {/* Placeholder History Items */}
              <div className="p-3 hover:bg-[#1f242d] rounded-xl cursor-pointer text-sm text-gray-400 truncate flex items-center gap-2 transition-colors">
                <MessageSquare size={14} /> New Session
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-gradient-to-b from-[#0f1117] to-[#0a0c10]">
        {/* Header */}
        <header className="h-16 border-b border-[#2d3748/50] flex items-center justify-between px-4 bg-[#0f1117]/80 backdrop-blur-xl z-30 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-3 w-full">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 p-2 hover:bg-white/5 rounded-lg active:scale-95">
              <Menu />
            </button>

            <div className="relative group flex-1 md:flex-none max-w-[200px]">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <span className="text-xs mr-1 opacity-50">Model:</span>
              </div>
              <select
                value={currentModel}
                onChange={(e) => setCurrentModel(e.target.value)}
                className="w-full appearance-none bg-[#1f242d] border border-[#2d3748] text-white py-2 pl-12 pr-8 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-[#2d3748] transition-colors"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-20 pb-[120px] px-4 md:px-8 scroll-smooth custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-90 px-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-indigo-500/10 p-6 rounded-full mb-6 relative"
              >
                <div className="text-6xl animate-pulse">🐉</div>
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse delay-75"></div>
              </motion.div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-3 bg-[length:200%_auto] animate-gradient">
                Draco.AI
              </h1>
              <p className="text-gray-400 max-w-md text-sm md:text-base leading-relaxed mb-8">
                Your premium AI companion. Advanced models, zero cost, instant answers.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl">
                {MODELS.slice(0, 3).map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-[#1f242d]/40 backdrop-blur-sm border border-[#2d3748] p-4 rounded-xl text-left hover:border-indigo-500/50 hover:bg-[#1f242d]/80 transition-all cursor-pointer group active:scale-[0.98]"
                    onClick={() => setCurrentModel(m.id)}
                  >
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">{m.icon}</div>
                    <div className="font-semibold text-sm text-gray-200">{m.name}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30 mt-1">
                      <Bot size={16} className="text-indigo-400" />
                    </div>
                  )}

                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 md:px-5 md:py-4 text-sm md:text-base leading-relaxed shadow-lg backdrop-blur-sm ${msg.role === "user"
                      ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-indigo-900/20"
                      : "bg-[#1e232e]/90 border border-[#2d3748] text-gray-100 rounded-bl-sm"
                    }`}>
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          return inline ? (
                            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs text-indigo-200" {...props}>
                              {children}
                            </code>
                          ) : (
                            <pre className="bg-[#0d1117] p-3 rounded-lg overflow-x-auto my-3 border border-white/5 shadow-inner">
                              <code className="font-mono text-xs text-gray-300" {...props}>
                                {children}
                              </code>
                            </pre>
                          )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0 border border-purple-500/30 mt-1">
                      <User size={16} className="text-purple-400" />
                    </div>
                  )}
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Bot size={16} className="text-indigo-400" />
                  </div>
                  <div className="bg-[#1e232e] border border-[#2d3748] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0f1117] via-[#0f1117]/95 to-transparent z-40 flex justify-center backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#1f242d] border border-[#2d3748] rounded-[24px] p-2 pl-4 flex items-end gap-2 shadow-2xl shadow-black/50 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message Draco..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 resize-none max-h-32 py-3 text-base md:text-sm custom-scrollbar"
              rows={1}
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-all mb-0.5 shrink-0 active:scale-90"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
