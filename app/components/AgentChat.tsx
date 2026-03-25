"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Send, Terminal, Play, Square, Loader2, ChevronRight, 
  Bot, User, AlertCircle, Cpu, ArrowLeft, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

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

export default function AgentChat({ userId, userPlan, onBack, onUpgrade, initialVmid, initialSessionId }: AgentChatProps) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [terminalEntries, setTerminalEntries] = useState<AgentEvent[]>([]);
  const [terminalCmd, setTerminalCmd] = useState("");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<"chat" | "terminal">("chat");
  const [agentStatus, setAgentStatus] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalEntries]);

  // Auto-connect when launched from dashboard with initialVmid
  useEffect(() => {
    if (initialVmid && initialSessionId && !session) {
      setSession({
        sessionId: initialSessionId,
        vmid: initialVmid,
        status: "running",
        createdAt: Date.now(),
      });
      setTerminalEntries([
        { type: "output", content: `Connected to container CT ${initialVmid}`, exitCode: 0 },
        { type: "output", content: "Type commands below or ask Draco in the chat.\n", exitCode: 0 },
      ]);
      setMessages([{
        role: "system",
        content: `\u{1F5A5}\uFE0F **Connected to CT ${initialVmid}.** Terminal is live. Type commands directly or ask Draco in the chat.`,
        timestamp: new Date().toISOString(),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVmid, initialSessionId]);

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
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">
            Draco Agent
          </h2>
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
        headers: { "Content-Type": "application/json" },
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

      setSession({
        sessionId: data.sessionId,
        vmid: data.vmid,
        status: data.status,
        createdAt: Date.now(),
      });

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
        const res = await fetch(`/api/agent/session?userId=${userId}`);
        const data = await res.json();
        
        // Match by sessionId OR by vmid (in case server restarted and lost the session metadata)
        const currentVmid = session?.vmid;
        const s = data.sessions?.find((s: any) => 
          s.sessionId === sessionId || 
          (currentVmid && s.vmid === currentVmid)
        );
        
        if (s?.status === "running") {
          setSession(prev => prev ? { ...prev, status: "running", containerIP: s.containerIP } : null);
          setMessages(prev => [...prev, {
            role: "system",
            content: "🖥️ **Session ready.** Your Linux container is live. Type in the chat to use Draco, or type commands directly in the terminal panel on the right.",
            timestamp: new Date().toISOString(),
          }]);
          setTerminalEntries(prev => [...prev, 
            { type: "output", content: `Connected to container CT ${s.vmid}`, exitCode: 0 },
            { type: "output", content: "Type commands here or ask Draco in the chat.\n", exitCode: 0 },
          ]);
          return;
        } else if (s?.status === "error") {
          setSession(prev => prev ? { ...prev, status: "error", error: s.error } : null);
          setMessages(prev => [...prev, {
            role: "system",
            content: `⚠️ Container failed: ${s.error}`,
            timestamp: new Date().toISOString(),
          }]);
          return;
        }
      } catch {}
    }

    // Timeout — polling exhausted
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, userId }),
      });
    } catch {}
    setSession(null);
    setTerminalEntries([]);
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

      if (!res.ok) {
        throw new Error(await res.text());
      }

      // Parse SSE events progressively
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
            } else if (event.type === "command" || event.type === "output") {
              setTerminalEntries(prev => [...prev, event]);
              setAgentStatus(event.type === "command" ? `Running: ${event.content}` : "");
            } else if (event.type === "response") {
              // Clean the response: strip <exec> tags and clean up
              let cleaned = event.content
                .replace(/<exec>[\s\S]*?<\/exec>/g, '') // Remove exec tags
                .trim();
              
              if (!cleaned) continue; // Skip empty responses
              
              // Add paragraph separation between response segments
              if (responseText) {
                responseText += "\n\n---\n\n" + cleaned;
              } else {
                responseText = cleaned;
              }
              
              // Update the assistant message progressively
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

      // Finalize the message timestamp
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

  // ── Direct terminal command execution ──
  const execDirect = async () => {
    if (!terminalCmd.trim() || terminalRunning || !session || session.status !== "running") return;
    const cmd = terminalCmd.trim();
    setTerminalCmd("");
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setTerminalRunning(true);

    setTerminalEntries(prev => [...prev, { type: "command", content: cmd }]);

    try {
      const res = await fetch("/api/agent/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vmid: session.vmid, command: cmd, userId }),
      });
      const data = await res.json();
      const output = [data.stdout, data.stderr ? `STDERR: ${data.stderr}` : ""].filter(Boolean).join("\n") || "(no output)";
      setTerminalEntries(prev => [...prev, { type: "output", content: output, exitCode: data.exitCode ?? 0 }]);
    } catch (err: any) {
      setTerminalEntries(prev => [...prev, { type: "output", content: `Error: ${err.message}`, exitCode: 1 }]);
    } finally {
      setTerminalRunning(false);
      setTimeout(() => terminalInputRef.current?.focus(), 50);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); execDirect(); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIdx = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIdx);
        setTerminalCmd(commandHistory[commandHistory.length - 1 - newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setTerminalCmd(commandHistory[commandHistory.length - 1 - newIdx]);
      } else { setHistoryIndex(-1); setTerminalCmd(""); }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setTerminalEntries([]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--sidebar-bg)]/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-secondary)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Terminal size={16} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--foreground)]">Draco Agent</div>
              <div className="text-[10px] text-[var(--color-secondary)]">
                {session?.status === "running" ? (
                  <span className="text-emerald-400">● Connected</span>
                ) : session?.status === "creating" ? (
                  <span className="text-yellow-400">● Starting...</span>
                ) : (
                  <span className="text-gray-500">● No session</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!session ? (
            <button
              onClick={createSession}
              disabled={isCreating}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              New Session
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(`/terminal/${session?.vmid}`, '_blank')}
                className="px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-bold transition-all flex items-center gap-2"
              >
                <Terminal size={14} />
                Open Terminal
              </button>
              <button
                onClick={endSession}
                className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center gap-2"
              >
                <Square size={14} />
                End Session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content — Split View */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel: Chat */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border-color)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 && !session && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <Cpu size={32} className="text-emerald-500/50" />
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">AI with a Computer</h3>
                <p className="text-sm text-[var(--color-secondary)] max-w-sm mb-6">
                  Start a session to give Draco its own Linux environment. 
                  It can write code, install tools, and build apps.
                </p>
                <button
                  onClick={createSession}
                  disabled={isCreating}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  Start Agent Session
                </button>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role !== "user" && (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.role === "system" 
                      ? "bg-yellow-500/10 border border-yellow-500/20" 
                      : "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30"
                  }`}>
                    {msg.role === "system" ? (
                      <AlertCircle size={14} className="text-yellow-400" />
                    ) : (
                      <Bot size={14} className="text-emerald-400" />
                    )}
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-[var(--color-primary)] text-white rounded-br-md"
                    : msg.role === "system"
                    ? "bg-yellow-500/5 border border-yellow-500/10 text-[var(--foreground)]"
                    : "bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground)]"
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          return isInline ? (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs" {...props}>
                              {children}
                            </code>
                          ) : (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ borderRadius: '8px', fontSize: '12px', margin: '8px 0' }}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          );
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
                    <User size={14} className="text-[var(--color-primary)]" />
                  </div>
                )}
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Loader2 size={14} className="text-purple-400 animate-spin" />
                </div>
                <div className="bg-[var(--input-bg)] border border-[var(--border-color)] rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-secondary)]">
                    <span className="animate-pulse">{agentStatus || "Working..."}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 p-4 border-t border-[var(--border-color)]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={session?.status === "running" ? "Tell Draco Agent what to build..." : "Start a session first..."}
                disabled={!session || session.status !== "running" || isLoading}
                rows={1}
                className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--color-secondary)] resize-none focus:outline-none focus:border-[var(--color-primary)]/50 disabled:opacity-50 transition-colors"
                style={{ minHeight: "44px", maxHeight: "120px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || !session || session.status !== "running"}
                className="p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Linux Terminal */}
        <div className="w-[45%] hidden md:flex flex-col bg-[#1a1b26] min-w-0">
          {/* Terminal title bar — like a real Linux terminal */}
          <div className="shrink-0 flex items-center px-3 py-2 bg-[#24283b] border-b border-[#414868]/30">
            <div className="flex gap-1.5 mr-3">
              <div className="w-3 h-3 rounded-full bg-[#f7768e] hover:brightness-125 cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-[#e0af68] hover:brightness-125 cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-[#9ece6a] hover:brightness-125 cursor-pointer" />
            </div>
            <div className="flex-1 text-center">
              <span className="text-[11px] font-mono text-[#a9b1d6]/50">
                {session?.vmid ? `root@draco-ct${session.vmid}: ~` : 'Terminal'}
              </span>
            </div>
            {session?.status === 'running' && (
              <span className="text-[9px] font-mono text-[#9ece6a]/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9ece6a] animate-pulse"></span>
                live
              </span>
            )}
          </div>
          
          {/* Terminal body */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-[1.6] custom-scrollbar bg-[#1a1b26]" onClick={() => terminalInputRef.current?.focus()}>
            {terminalEntries.length === 0 ? (
              <div className="text-[#565f89]">
                <div className="text-[#9ece6a] mb-1">Welcome to Draco Agent Linux Terminal</div>
                <div className="text-[#565f89] text-xs mb-3">Ubuntu 22.04.4 LTS — Draco Container</div>
                <div className="text-[#565f89] text-xs">
                  {session?.status === 'running'
                    ? 'Type commands below or ask Draco in the chat panel.'
                    : 'Start a session to connect...'}
                </div>
              </div>
            ) : (
              terminalEntries.map((entry, i) => (
                <div key={i} className="mb-1">
                  {entry.type === "command" && (
                    <div className="flex items-start gap-0">
                      <span className="text-[#9ece6a] select-none">root@draco</span>
                      <span className="text-[#a9b1d6] select-none">:</span>
                      <span className="text-[#7aa2f7] select-none">~</span>
                      <span className="text-[#a9b1d6] select-none">$ </span>
                      <pre className="text-[#c0caf5] whitespace-pre-wrap break-all">{entry.content}</pre>
                    </div>
                  )}
                  {entry.type === "output" && (
                    <pre className={`whitespace-pre-wrap break-all ml-0 ${
                      entry.exitCode !== undefined && entry.exitCode !== 0 
                        ? 'text-[#f7768e]' 
                        : 'text-[#a9b1d6]/80'
                    }`}>{entry.content}</pre>
                  )}
                </div>
              ))
            )}
            {terminalRunning && (
              <div className="flex items-center gap-1 text-[#565f89] animate-pulse">
                <span>⏳</span> running...
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Terminal input — real bash prompt look */}
          <div className="shrink-0 border-t border-[#414868]/20 px-4 py-2.5 bg-[#1a1b26]">
            <div className="flex items-center gap-0 font-mono text-[13px]">
              <span className="text-[#9ece6a] select-none">root@draco</span>
              <span className="text-[#a9b1d6] select-none">:</span>
              <span className="text-[#7aa2f7] select-none">~</span>
              <span className="text-[#a9b1d6] select-none">$&nbsp;</span>
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalCmd}
                onChange={e => setTerminalCmd(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                placeholder={session?.status === "running" ? "" : "Start a session first"}
                disabled={!session || session.status !== "running" || terminalRunning}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-[#c0caf5] placeholder-[#565f89]/50 outline-none disabled:opacity-30 caret-[#c0caf5]"
              />
              {terminalRunning && <Loader2 size={12} className="text-[#7aa2f7] animate-spin" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
