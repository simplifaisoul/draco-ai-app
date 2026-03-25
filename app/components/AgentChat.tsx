"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Play, Square, Loader2,
  Bot, User, AlertCircle, Cpu, ArrowLeft, Zap,
  Terminal, ExternalLink, Monitor, MessageSquare, Wifi, Clock,
  Paperclip, FileText, X, Download, File, FileSpreadsheet,
  ChevronRight, PanelRightOpen, PanelRightClose
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

interface Attachment {
  name: string;
  content: string;
  size: number;
}

interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  events?: AgentEvent[];
  attachments?: Attachment[];
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

const LOCAL_STORAGE_KEY = "draco_agent_session";

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

// ── File type icon helper ──
function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return <File size={20} className="text-red-400" />;
  if (['doc', 'docx'].includes(ext)) return <FileText size={20} className="text-blue-400" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={20} className="text-green-400" />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return <File size={20} className="text-purple-400" />;
  if (['zip', 'tar', 'gz'].includes(ext)) return <File size={20} className="text-yellow-400" />;
  return <File size={20} className="text-white/40" />;
}

// ── Download Card Component ──
function DownloadCard({ filename, filepath, vmid, idToken }: { filename: string; filepath: string; vmid: number; idToken: string }) {
  const [downloading, setDownloading] = useState(false);
  const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
  
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = `/api/agent/download?vmid=${vmid}&path=${encodeURIComponent(filepath)}&token=${encodeURIComponent(idToken)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-3 group"
    >
      <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-[#1a1a2e]/80 to-[#16162a]/80 border border-white/[0.06] hover:border-white/10 transition-all cursor-pointer shadow-lg shadow-black/20"
        onClick={handleDownload}
      >
        {/* File type badge */}
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
          <FileIcon filename={filename} />
        </div>
        
        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{filename}</p>
          <p className="text-[11px] text-white/25 mt-0.5">{ext} Document • Ready to download</p>
        </div>
        
        {/* Download button */}
        <button
          disabled={downloading}
          className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-all group-hover:bg-purple-500/15 group-hover:border-purple-500/20 group-hover:text-purple-400"
        >
          {downloading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default function AgentChat({ userId, userPlan, onBack, onUpgrade, initialVmid, initialSessionId }: AgentChatProps) {
  const { user } = useAuth();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [isRecovering, setIsRecovering] = useState(true);
  const [idToken, setIdToken] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const xtermRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get Firebase ID token
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token: string) => setIdToken(token));
      const interval = setInterval(() => {
        user.getIdToken(true).then((token: string) => setIdToken(token));
      }, 50 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Session Recovery ──
  useEffect(() => {
    const recover = async () => {
      if (initialVmid && initialSessionId) {
        setSession({ sessionId: initialSessionId, vmid: initialVmid, status: "running", createdAt: Date.now() });
        saveSessionLocal({ vmid: initialVmid, sessionId: initialSessionId, userId });
        setMessages([{ role: "system", content: `🖥️ **Connected to CT ${initialVmid}**. Your machine is live — ask me to build anything or use the terminal.`, timestamp: new Date().toISOString() }]);
        setIsRecovering(false);
        return;
      }
      const saved = loadSessionLocal();
      if (saved && saved.userId === userId) {
        try {
          const res = await fetch(`/api/agent/session?userId=${userId}&idToken=${encodeURIComponent(idToken)}`);
          const data = await res.json();
          const match = data.sessions?.find((s: any) => s.vmid === saved.vmid || s.sessionId === saved.sessionId);
          if (match && (match.status === "running" || match.status === "creating")) {
            setSession({ sessionId: match.sessionId || saved.sessionId, vmid: match.vmid, status: match.status, containerIP: match.containerIP, createdAt: match.createdAt || Date.now() });
            if (match.status === "running") {
              setMessages([{ role: "system", content: `🖥️ **Reconnected to CT ${match.vmid}**${match.containerIP ? ` (${match.containerIP})` : ""}. Session restored.`, timestamp: new Date().toISOString() }]);
            } else {
              setMessages([{ role: "system", content: `⏳ **CT ${match.vmid} is starting up...** Waiting for container.`, timestamp: new Date().toISOString() }]);
              pollSessionStatus(match.sessionId || saved.sessionId);
            }
            setIsRecovering(false);
            return;
          }
        } catch {}
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
      <div className="flex-1 flex items-center justify-center bg-[#0a0a12]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center">
            <Cpu size={36} className="text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Draco Agent</h2>
          <p className="text-white/40 mb-6 text-sm leading-relaxed">
            Give Draco its own Linux computer. It writes code, generates documents, installs tools, and builds apps — all autonomously.
          </p>
          <button onClick={onUpgrade} className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 mx-auto">
            <Zap size={18} /> Upgrade to Pro
          </button>
          <button onClick={onBack} className="mt-4 text-sm text-white/30 hover:text-white/60 transition-colors">← Back to Chat</button>
        </motion.div>
      </div>
    );
  }

  // ── Session Management ──
  const createSession = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ userId, userPlan }),
      });
      const data = await res.json();
      if (data.error) { setMessages(prev => [...prev, { role: "system", content: `⚠️ ${data.error}`, timestamp: new Date().toISOString() }]); return; }
      setSession({ sessionId: data.sessionId, vmid: data.vmid, status: data.status, createdAt: Date.now() });
      saveSessionLocal({ vmid: data.vmid, sessionId: data.sessionId, userId });
      pollSessionStatus(data.sessionId);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "system", content: `⚠️ Failed: ${err.message}`, timestamp: new Date().toISOString() }]);
    } finally { setIsCreating(false); }
  };

  const pollSessionStatus = async (sessionId: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/agent/session?userId=${userId}&idToken=${encodeURIComponent(idToken)}`);
        const data = await res.json();
        const s = data.sessions?.find((s: any) => s.sessionId === sessionId);
        if (s?.status === "running") {
          setSession(prev => prev ? { ...prev, status: "running", containerIP: s.containerIP } : null);
          setMessages(prev => [...prev, { role: "system", content: `🖥️ **Machine ready!** CT ${s.vmid}${s.containerIP ? ` • ${s.containerIP}` : ""}\n\nYour Linux environment is live. Ask me to build anything, generate documents, or use the terminal.`, timestamp: new Date().toISOString() }]);
          return;
        } else if (s?.status === "error") {
          setSession(prev => prev ? { ...prev, status: "error", error: s.error } : null);
          setMessages(prev => [...prev, { role: "system", content: `⚠️ ${s.error}`, timestamp: new Date().toISOString() }]);
          clearSessionLocal(); return;
        }
      } catch {}
    }
    setMessages(prev => [...prev, { role: "system", content: "⚠️ Container timeout. Try creating a new one.", timestamp: new Date().toISOString() }]);
  };

  const endSession = async () => {
    if (!session) return;
    try {
      await fetch("/api/agent/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: session.sessionId, userId }),
      });
    } catch {}
    setSession(null);
    clearSessionLocal();
    setMessages(prev => [...prev, { role: "system", content: "🔴 Session ended. Container destroyed.", timestamp: new Date().toISOString() }]);
  };

  // ── File Upload Logic ──
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 1024 * 1024) {
        setMessages(prev => [...prev, { role: "system", content: `⚠️ File "${file.name}" is too large (max 1MB).`, timestamp: new Date().toISOString() }]);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setAttachments(prev => [...prev, { name: file.name, content, size: file.size }]);
      };
      reader.readAsText(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // ── Send Message ──
  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading || !session || session.status !== "running") return;

    let messageContent = input.trim();
    if (attachments.length > 0) {
      const fileContext = attachments.map(a => `\n\n--- Attached File: ${a.name} ---\n\`\`\`\n${a.content}\n\`\`\``).join("");
      messageContent += fileContext;
    }

    const userMessage: AgentMessage = {
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
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
              if (xtermRef.current) {
                xtermRef.current.write(`\r\n\x1b[1;33m❯\x1b[0m \x1b[1;37m${event.content}\x1b[0m\r\n`);
              }
            } else if (event.type === "output") {
              setAgentStatus("");
              if (xtermRef.current) {
                const outLines = event.content.split("\n");
                for (const l of outLines) {
                  const color = event.exitCode !== undefined && event.exitCode !== 0 ? "\x1b[31m" : "\x1b[0;37m";
                  xtermRef.current.write(`${color}${l}\x1b[0m\r\n`);
                }
              }
            } else if (event.type === "response") {
              let cleaned = event.content.replace(/<exec>[\s\S]*?<\/exec>/g, "").trim();
              if (!cleaned) continue;
              if (responseText) { responseText += "\n\n---\n\n" + cleaned; } else { responseText = cleaned; }
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
      setMessages(prev => [...prev, { role: "system", content: `⚠️ ${err.message}`, timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
      setAgentStatus("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const getUptime = () => {
    if (!session?.createdAt) return "—";
    const mins = Math.floor((Date.now() - session.createdAt) / 60000);
    if (mins < 1) return "< 1m";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // ── Render content with download cards ──
  const renderMessageContent = (content: string) => {
    // Parse [DOWNLOAD:filename:path] patterns
    const downloadRegex = /\[DOWNLOAD:([^:]+):([^\]]+)\]/g;
    const parts: (string | { type: 'download'; filename: string; filepath: string })[] = [];
    let lastIdx = 0;
    let match;

    while ((match = downloadRegex.exec(content)) !== null) {
      if (match.index > lastIdx) {
        parts.push(content.slice(lastIdx, match.index));
      }
      parts.push({ type: 'download', filename: match[1], filepath: match[2] });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < content.length) parts.push(content.slice(lastIdx));

    return (
      <>
        {parts.map((part, i) => {
          if (typeof part === 'string') {
            return (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match;
                    return isInline ? (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                    ) : (
                      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ borderRadius: "10px", fontSize: "12px", margin: "10px 0", background: "#0d0d14", border: "1px solid rgba(255,255,255,0.04)" }}>
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    );
                  },
                }}
              >
                {part}
              </ReactMarkdown>
            );
          }
          return <DownloadCard key={i} filename={part.filename} filepath={part.filepath} vmid={session?.vmid || 0} idToken={idToken} />;
        })}
      </>
    );
  };

  // ── RENDER ──
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a12] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-purple-500/10 backdrop-blur-sm border-2 border-dashed border-purple-500/40 rounded-xl flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <Paperclip size={40} className="text-purple-400 mx-auto mb-3" />
              <p className="text-white font-semibold">Drop files to attach</p>
              <p className="text-white/30 text-xs mt-1">.txt, .md, .csv, .json, .py, .js and more</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <div className="shrink-0 border-b border-white/[0.04] bg-[#0c0c15]/90 backdrop-blur-xl z-30">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-6xl mx-auto w-full">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                session?.status === "running" ? "bg-emerald-500/10 border border-emerald-500/15" : "bg-white/[0.04] border border-white/[0.04]"
              }`}>
                <Monitor size={16} className={session?.status === "running" ? "text-emerald-400" : "text-white/15"} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  {session ? `CT ${session.vmid}` : "Draco Agent"}
                  {session && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      session.status === "running" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                      : session.status === "creating" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/15"
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
                  <div className="flex items-center gap-3 text-[10px] text-white/20 mt-0.5">
                    {session.containerIP && <span className="flex items-center gap-1"><Wifi size={9} />{session.containerIP}</span>}
                    <span className="flex items-center gap-1"><Clock size={9} />{getUptime()}</span>
                    <span className="flex items-center gap-1"><Cpu size={9} />1 vCPU / 512MB</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {session?.status === "running" && (
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  showTerminal
                    ? "bg-emerald-500/15 border border-emerald-500/20 text-emerald-400"
                    : "bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.04] text-white/40 hover:text-white/60"
                }`}
              >
                {showTerminal ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                Terminal
              </button>
            )}
            {session?.status === "running" && (
              <button
                onClick={() => window.open(`/terminal/${session.vmid}`, "_blank")}
                className="px-3 py-2 rounded-lg bg-purple-500/8 hover:bg-purple-500/15 border border-purple-500/10 text-purple-400/70 hover:text-purple-400 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <ExternalLink size={12} /> Full Screen
              </button>
            )}
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
              <button
                onClick={endSession}
                className="px-3 py-2 rounded-lg bg-red-500/8 hover:bg-red-500/15 border border-red-500/8 text-red-400/50 hover:text-red-400 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Square size={12} /> End
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* ── Center Panel: Chat ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {/* Empty state */}
              {messages.length === 0 && !session && !isRecovering && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/10 flex items-center justify-center mb-6 mx-auto">
                      <Cpu size={36} className="text-emerald-500/30" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">AI with a Computer</h3>
                    <p className="text-sm text-white/25 max-w-md mb-8 leading-relaxed">
                      Start a machine to give Draco its own Linux environment.
                      It writes code, generates PDFs & documents, installs tools, and builds apps — all autonomously.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-md mb-8">
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                        <FileText size={20} className="text-blue-400/50 mx-auto mb-2" />
                        <p className="text-[11px] text-white/25">Generate PDFs</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                        <Terminal size={20} className="text-emerald-400/50 mx-auto mb-2" />
                        <p className="text-[11px] text-white/25">Run Code</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                        <Paperclip size={20} className="text-purple-400/50 mx-auto mb-2" />
                        <p className="text-[11px] text-white/25">Upload Files</p>
                      </div>
                    </div>
                    <button
                      onClick={createSession}
                      disabled={isCreating}
                      className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-emerald-500/15 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                    >
                      {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                      Start Machine
                    </button>
                  </motion.div>
                </div>
              )}

              {isRecovering && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                  <Loader2 size={24} className="text-purple-400 animate-spin mb-3" />
                  <p className="text-sm text-white/20">Checking for existing machines...</p>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role !== "user" && (
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === "system"
                        ? "bg-yellow-500/8 border border-yellow-500/10"
                        : "bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/10"
                    }`}>
                      {msg.role === "system" ? <AlertCircle size={14} className="text-yellow-400/60" /> : <Bot size={14} className="text-emerald-400" />}
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-600/90 to-purple-700/90 text-white rounded-br-md shadow-lg shadow-purple-500/10"
                      : msg.role === "system"
                      ? "bg-yellow-500/[0.04] border border-yellow-500/[0.06] text-white/60"
                      : "bg-[#12121e] border border-white/[0.04] text-white/80"
                  }`}>
                    {/* User attachments */}
                    {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.attachments.map((a, ai) => (
                          <div key={ai} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 text-[11px] text-white/70">
                            <Paperclip size={10} /> {a.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none break-words [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_hr]:my-3 [&_hr]:border-white/5">
                      {msg.role === "user" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content.replace(/\n\n--- Attached File:[\s\S]*$/g, '')}
                        </ReactMarkdown>
                      ) : (
                        renderMessageContent(msg.content)
                      )}
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-purple-400" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Thinking indicator */}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/15 flex items-center justify-center">
                    <Loader2 size={14} className="text-purple-400 animate-spin" />
                  </div>
                  <div className="bg-[#12121e] border border-white/[0.04] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-white/25">
                      <span className="animate-pulse">{agentStatus || "Thinking..."}</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Input Omnibar ── */}
          <div className="shrink-0 border-t border-white/[0.03] bg-gradient-to-t from-[#0a0a12] via-[#0a0a12] to-transparent p-4 pt-6">
            <div className="max-w-3xl mx-auto">
              {/* Attachments preview */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-2 mb-3"
                  >
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/8 border border-purple-500/10 text-xs text-purple-300">
                        <FileText size={12} />
                        <span className="max-w-[120px] truncate">{a.name}</span>
                        <span className="text-white/15">{(a.size / 1024).toFixed(1)}KB</span>
                        <button onClick={() => removeAttachment(i)} className="text-white/20 hover:text-white/50"><X size={12} /></button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative group">
                {/* Glow border */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/20 via-emerald-600/10 to-purple-600/20 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-sm" />
                
                <div className="relative bg-[#12121e] rounded-2xl border border-white/[0.06] focus-within:border-purple-500/20 transition-all shadow-2xl shadow-black/30">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={session?.status === "running" ? "Ask Draco to build, generate docs, run code..." : "Start a machine first..."}
                    disabled={!session || session.status !== "running" || isLoading}
                    rows={1}
                    className="w-full bg-transparent text-white px-4 pt-4 pb-2 text-sm placeholder-white/15 resize-none focus:outline-none disabled:opacity-25 transition-colors"
                    style={{ minHeight: "44px", maxHeight: "160px" }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = Math.min(target.scrollHeight, 160) + "px";
                    }}
                  />
                  
                  {/* Bottom toolbar */}
                  <div className="flex items-center justify-between px-3 pb-2.5">
                    <div className="flex items-center gap-1">
                      {/* Attach button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!session || session.status !== "running"}
                        className="p-2 rounded-lg text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition-all disabled:opacity-20"
                        title="Attach files"
                      >
                        <Paperclip size={16} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.csv,.json,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.sh,.sql,.log,.env,.cfg,.ini,.toml"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                      />
                    </div>
                    
                    <button
                      onClick={sendMessage}
                      disabled={(!input.trim() && attachments.length === 0) || isLoading || !session || session.status !== "running"}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white transition-all disabled:opacity-15 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="text-center text-[10px] text-white/10 mt-2.5">
                Draco Agent has a live Linux machine. It can run code, generate documents, and install anything.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Panel: Terminal (Toggle) ── */}
        <AnimatePresence>
          {showTerminal && session?.status === "running" && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "45%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex flex-col bg-[#1a1b26] min-w-0 overflow-hidden border-l border-white/[0.04]"
            >
              {/* Terminal title bar */}
              <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#111118] border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f7768e]/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#e0af68]/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9ece6a]/50" />
                  </div>
                  <span className="text-[11px] font-mono text-white/15 ml-1">
                    root@draco-ct{session.vmid}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-emerald-400/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-pulse" />
                    live
                  </span>
                  <button onClick={() => setShowTerminal(false)} className="p-1 rounded hover:bg-white/5 text-white/15 hover:text-white/30 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
              {/* Terminal body */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <XTerminal ref={xtermRef} vmid={session.vmid} idToken={idToken} fontSize={13} autoFocus={false} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
