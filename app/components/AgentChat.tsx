"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Play, Square, Loader2,
  Bot, User, AlertCircle, Cpu, ArrowLeft, Zap,
  Terminal, ExternalLink, Monitor, MessageSquare, Wifi, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import dynamic from "next/dynamic";
import { useAuth } from "@/app/lib/AuthContext";

// Dynamic import XTerminal to avoid SSR issues
const XTerminal = dynamic(() => import("./XTerminal"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#1a1b26]">
      <div className="flex items-center gap-2 text-sm text-white/30">
        <div className="w-4 h-4 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
        Loading terminal...
      </div>
    </div>
  ),
});

interface AgentEvent {
  type: "response" | "command" | "output" | "status";
  content: string;
  exitCode?: number;
}

interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  events?: AgentEvent[];
}

interface AgentSession {
  sessionId: string;
  vmid: number;
  status: "creating" | "running" | "stopping" | "stopped" | "error";
  containerIP?: string;
  createdAt: number;
  error?: string;
}

interface AgentChatProps {
  userId: string;
  userPlan: string;
  onBack: () => void;
  onUpgrade: () => void;
  initialVmid?: number;
  initialSessionId?: string;
}

type MobileTab = "chat" | "terminal";

const LOCAL_STORAGE_KEY = "draco_agent_session";

// Persist session to localStorage
function saveSessionLocal(data: { vmid: number; sessionId: string; userId: string }) {
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data)); } catch {}
}
function clearSessionLocal() {
  try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
}
function loadSessionLocal(): { vmid: number; sessionId: string; userId: string } | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export default function AgentChat({ userId, userPlan, onBack, onUpgrade, initialVmid, initialSessionId }: AgentChatProps) {
  const { user } = useAuth();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [isRecovering, setIsRecovering] = useState(true);
  const [idToken, setIdToken] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const xtermRef = useRef<any>(null);

  // Get Firebase ID token for authenticated API calls
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token: string) => setIdToken(token));
      // Refresh token every 50 minutes
      const interval = setInterval(() => {
        user.getIdToken(true).then((token: string) => setIdToken(token));
      }, 50 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Session Recovery: auto-reconnect to existing VM on mount ──
  useEffect(() => {
    const recover = async () => {
      // Priority 1: Props from dashboard
      if (initialVmid && initialSessionId) {
        setSession({
          sessionId: initialSessionId,
          vmid: initialVmid,
          status: "running",
          createdAt: Date.now(),
        });
        saveSessionLocal({ vmid: initialVmid, sessionId: initialSessionId, userId });
        setMessages([{
          role: "system",
          content: `🖥️ **Connected to CT ${initialVmid}**. Terminal is live — type commands in the terminal panel or ask Draco in the chat.`,
          timestamp: new Date().toISOString(),
        }]);
        setIsRecovering(false);
        return;
      }

      // Priority 2: localStorage recovery
      const saved = loadSessionLocal();
      if (saved && saved.userId === userId) {
        try {
          const res = await fetch(`/api/agent/session?userId=${userId}&idToken=${encodeURIComponent(idToken)}`);
          const data = await res.json();
          const match = data.sessions?.find((s: any) =>
            s.vmid === saved.vmid || s.sessionId === saved.sessionId
          );

          if (match && (match.status === "running" || match.status === "creating")) {
            setSession({
              sessionId: match.sessionId || saved.sessionId,
              vmid: match.vmid,
              status: match.status,
              containerIP: match.containerIP,
              createdAt: match.createdAt || Date.now(),
            });
            if (match.status === "running") {
              setMessages([{
                role: "system",
                content: `🖥️ **Reconnected to CT ${match.vmid}**${match.containerIP ? ` (${match.containerIP})` : ""}. Session restored.`,
                timestamp: new Date().toISOString(),
              }]);
            } else {
              setMessages([{
                role: "system",
                content: `⏳ **CT ${match.vmid} is starting up...** Waiting for container to be ready.`,
                timestamp: new Date().toISOString(),
              }]);
              pollSessionStatus(match.sessionId || saved.sessionId);
            }
            setIsRecovering(false);
            return;
          }
        } catch {}
        // Stale data — clear it
        clearSessionLocal();
      }
      setIsRecovering(false);
    };

    recover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pro-only gate
  if (userPlan === "free") {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--background)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto p-8"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center">
            <Cpu size={36} className="text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">Draco Agent</h2>
          <p className="text-[var(--color-secondary)] mb-6 text-sm leading-relaxed">
            Give Draco its own Linux computer. It installs tools, writes code,
            runs scripts, and builds apps — all from chat.
          </p>
          <button
            onClick={onUpgrade}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2 mx-auto"
          >
            <Zap size={18} />
            Upgrade to Pro
          </button>
          <button
            onClick={onBack}
            className="mt-4 text-sm text-[var(--color-secondary)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Back to Chat
          </button>
        </motion.div>
      </div>
    );
  }

  // Create new session
  const createSession = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId, userPlan }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          role: "system",
          content: `⚠️ ${data.error}`,
          timestamp: new Date().toISOString(),
        }]);
        return;
      }

      const newSession: AgentSession = {
        sessionId: data.sessionId,
        vmid: data.vmid,
        status: data.status,
        createdAt: Date.now(),
      };
      setSession(newSession);
      saveSessionLocal({ vmid: data.vmid, sessionId: data.sessionId, userId });

      // Poll for session ready
      pollSessionStatus(data.sessionId);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "system",
        content: `⚠️ Failed to create session: ${err.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsCreating(false);
    }
  };

  // Poll session status until running
  const pollSessionStatus = async (sessionId: string) => {
    const maxPolls = 30;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/agent/session?userId=${userId}&idToken=${encodeURIComponent(idToken)}`);
        const data = await res.json();
        const s = data.sessions?.find((s: any) => s.sessionId === sessionId);

        if (s?.status === "running") {
          setSession(prev => prev ? { ...prev, status: "running", containerIP: s.containerIP } : null);
          setMessages(prev => [...prev, {
            role: "system",
            content: `🖥️ **Session ready!** CT ${s.vmid}${s.containerIP ? ` • ${s.containerIP}` : ""} — Your Linux container is live.\n\nType in the chat to use Draco Agent, or switch to the terminal panel for direct commands.`,
            timestamp: new Date().toISOString(),
          }]);
          return;
        } else if (s?.status === "error") {
          setSession(prev => prev ? { ...prev, status: "error", error: s.error } : null);
          setMessages(prev => [...prev, {
            role: "system",
            content: `⚠️ Container failed: ${s.error}`,
            timestamp: new Date().toISOString(),
          }]);
          clearSessionLocal();
          return;
        }
      } catch {}
    }

    setMessages(prev => [...prev, {
      role: "system",
      content: "⚠️ Container is taking too long to start. Try ending the session and creating a new one.",
      timestamp: new Date().toISOString(),
    }]);
  };

  // End session
  const endSession = async () => {
    if (!session) return;
    try {
      await fetch("/api/agent/session", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ sessionId: session.sessionId, userId }),
      });
    } catch {}
    setSession(null);
    clearSessionLocal();
    setMessages(prev => [...prev, {
      role: "system",
      content: "🔴 Agent session ended. Container destroyed.",
      timestamp: new Date().toISOString(),
    }]);
  };

  // Send message to agent
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !session || session.status !== "running") return;

    const userMessage: AgentMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vmid: session.vmid,
          messages: [...messages, userMessage].map(m => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let responseText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6);
          if (dataStr === "[DONE]") continue;

          try {
            const event: AgentEvent = JSON.parse(dataStr);

            if (event.type === "status") {
              setAgentStatus(event.content);
            } else if (event.type === "command") {
              setAgentStatus(`Running: ${event.content}`);
              // Write command to xterm
              if (xtermRef.current) {
                xtermRef.current.write(`\r\n\x1b[1;33m❯\x1b[0m \x1b[1;37m${event.content}\x1b[0m\r\n`);
              }
            } else if (event.type === "output") {
              setAgentStatus("");
              // Write output to xterm
              if (xtermRef.current) {
                const lines = event.content.split("\n");
                for (const l of lines) {
                  const color = event.exitCode !== undefined && event.exitCode !== 0 ? "\x1b[31m" : "\x1b[0;37m";
                  xtermRef.current.write(`${color}${l}\x1b[0m\r\n`);
                }
              }
            } else if (event.type === "response") {
              let cleaned = event.content
                .replace(/<exec>[\s\S]*?<\/exec>/g, "")
                .trim();

              if (!cleaned) continue;

              if (responseText) {
                responseText += "\n\n---\n\n" + cleaned;
              } else {
                responseText = cleaned;
              }

              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.timestamp === "streaming") {
                  return [...prev.slice(0, -1), { ...last, content: responseText.trim() }];
                }
                return [...prev, { role: "assistant", content: responseText.trim(), timestamp: "streaming" }];
              });
            }
          } catch {}
        }
      }

      setMessages(prev => prev.map(m => m.timestamp === "streaming" ? { ...m, timestamp: new Date().toISOString() } : m));
      setAgentStatus("");

    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "system",
        content: `⚠️ ${err.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      setAgentStatus("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getUptime = () => {
    if (!session?.createdAt) return "—";
    const mins = Math.floor((Date.now() - session.createdAt) / 60000);
    if (mins < 1) return "< 1m";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const statusColor = session?.status === "running" ? "emerald" : session?.status === "creating" ? "yellow" : "gray";

  // ── RENDER ──
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b10]">
      {/* ── Top Bar: Machine Status ── */}
      <div className="shrink-0 border-b border-white/5 bg-[#0f0f16]">
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Left: Back + Machine Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                session?.status === "running"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-white/5 border border-white/5"
              }`}>
                <Monitor size={16} className={session?.status === "running" ? "text-emerald-400" : "text-white/20"} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  {session ? `CT ${session.vmid}` : "Draco Agent"}
                  {session && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      session.status === "running"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                        : session.status === "creating"
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/15"
                        : "bg-red-500/10 text-red-400 border border-red-500/15"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        session.status === "running" ? "bg-emerald-400 animate-pulse" :
                        session.status === "creating" ? "bg-yellow-400 animate-pulse" : "bg-red-400"
                      }`} />
                      {session.status}
                    </span>
                  )}
                </div>
                {session?.status === "running" && (
                  <div className="flex items-center gap-3 text-[10px] text-white/25 mt-0.5">
                    {session.containerIP && (
                      <span className="flex items-center gap-1"><Wifi size={9} />{session.containerIP}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock size={9} />{getUptime()}</span>
                    <span className="flex items-center gap-1"><Cpu size={9} />1 vCPU / 512MB</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {!session ? (
              <button
                onClick={createSession}
                disabled={isCreating || isRecovering}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isCreating || isRecovering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {isRecovering ? "Checking..." : "Start Machine"}
              </button>
            ) : (
              <>
                {session.status === "running" && (
                  <button
                    onClick={() => window.open(`/terminal/${session.vmid}`, "_blank")}
                    className="px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/15 text-purple-400 text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <ExternalLink size={12} />
                    Full Terminal
                  </button>
                )}
                <button
                  onClick={endSession}
                  className="px-3 py-2 rounded-lg bg-red-500/8 hover:bg-red-500/15 border border-red-500/10 text-red-400/70 hover:text-red-400 text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Square size={12} />
                  End
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex md:hidden border-t border-white/5">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all ${
              mobileTab === "chat"
                ? "text-white border-b-2 border-purple-500 bg-purple-500/5"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            <MessageSquare size={14} />
            Chat
          </button>
          <button
            onClick={() => setMobileTab("terminal")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all ${
              mobileTab === "terminal"
                ? "text-white border-b-2 border-emerald-500 bg-emerald-500/5"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            <Terminal size={14} />
            Terminal
          </button>
        </div>
      </div>

      {/* ── Main Content: Split Panel ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── Left Panel: Chat ── */}
        <div className={`flex flex-col min-w-0 border-r border-white/5 ${
          mobileTab === "chat" ? "flex-1" : "hidden md:flex md:flex-1"
        }`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 && !session && !isRecovering && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/15 flex items-center justify-center mb-4">
                  <Cpu size={32} className="text-emerald-500/40" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">AI with a Computer</h3>
                <p className="text-sm text-white/25 max-w-sm mb-6 leading-relaxed">
                  Start a machine to give Draco its own Linux environment.
                  It writes code, installs tools, and builds apps — autonomously.
                </p>
                <button
                  onClick={createSession}
                  disabled={isCreating}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-emerald-500/15 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  Start Machine
                </button>
              </div>
            )}

            {isRecovering && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 size={24} className="text-purple-400 animate-spin mb-3" />
                <p className="text-sm text-white/25">Checking for existing machines...</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role !== "user" && (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "system"
                      ? "bg-yellow-500/10 border border-yellow-500/15"
                      : "bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border border-emerald-500/20"
                  }`}>
                    {msg.role === "system" ? (
                      <AlertCircle size={13} className="text-yellow-400/70" />
                    ) : (
                      <Bot size={13} className="text-emerald-400" />
                    )}
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-br-md shadow-lg shadow-purple-500/10"
                    : msg.role === "system"
                    ? "bg-yellow-500/5 border border-yellow-500/8 text-white/70"
                    : "bg-[#141420] border border-white/5 text-white/80"
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none break-words [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_hr]:my-3 [&_hr]:border-white/5">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const isInline = !match;
                          return isInline ? (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                              {children}
                            </code>
                          ) : (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ borderRadius: "8px", fontSize: "12px", margin: "8px 0", background: "#0d0d14" }}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={13} className="text-purple-400" />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Thinking indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/15 to-fuchsia-500/15 border border-purple-500/20 flex items-center justify-center">
                  <Loader2 size={13} className="text-purple-400 animate-spin" />
                </div>
                <div className="bg-[#141420] border border-white/5 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-white/30">
                    <span className="animate-pulse">{agentStatus || "Thinking..."}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="shrink-0 p-3 border-t border-white/5 bg-[#0d0d14]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={session?.status === "running" ? "Tell Draco Agent what to build..." : "Start a machine first..."}
                disabled={!session || session.status !== "running" || isLoading}
                rows={1}
                className="flex-1 bg-[#141420] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-white/15 resize-none focus:outline-none focus:border-purple-500/30 disabled:opacity-30 transition-colors"
                style={{ minHeight: "44px", maxHeight: "120px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || !session || session.status !== "running"}
                className="p-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Panel: xterm.js Terminal (Desktop always visible, Mobile tab) ── */}
        <div className={`flex flex-col bg-[#1a1b26] min-w-0 overflow-hidden ${
          mobileTab === "terminal" ? "flex-1 h-full" : "hidden md:flex md:w-[45%] md:h-auto"
        }`}>
          {/* Terminal title bar */}
          <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#111118] border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f7768e]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#e0af68]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#9ece6a]/60" />
              </div>
              <span className="text-[11px] font-mono text-white/20 ml-1">
                {session?.vmid ? `root@draco-ct${session.vmid}` : "Terminal"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {session?.status === "running" && (
                <>
                  <span className="text-[9px] font-mono text-emerald-400/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
                    live
                  </span>
                  <button
                    onClick={() => window.open(`/terminal/${session.vmid}`, "_blank")}
                    className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink size={11} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Terminal body */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {session?.status === "running" ? (
              <XTerminal
                ref={xtermRef}
                vmid={session.vmid}
                idToken={idToken}
                fontSize={13}
                autoFocus={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Terminal size={28} className="text-white/10 mb-3" />
                <p className="text-xs text-white/15">
                  {session?.status === "creating" ? "Waiting for container..." : "Start a machine to use the terminal"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
