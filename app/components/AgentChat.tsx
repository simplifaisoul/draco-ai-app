"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Loader2, ArrowLeft, Square, Cpu, Wifi, Clock, Play,
  Terminal as TerminalIcon, FolderOpen, Monitor, MessageSquare,
  Maximize2, Minimize2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useAuth } from "@/app/lib/AuthContext";
import WorkspaceFiles from "./WorkspaceFiles";
import AgentMessages, { AgentEvent } from "./AgentMessages";
import AgentInput from "./AgentInput";

// Dynamic import XTerminal to avoid SSR issues
const XTerminal = dynamic(() => import("./XTerminal"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a12]">
      <div className="flex items-center gap-3 text-sm text-white/30">
        <div className="w-5 h-5 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
        Initializing terminal…
      </div>
    </div>
  ),
});

// ── Types ──
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

// ── Local Storage Helpers ──
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

// ── Main Component ──
export default function AgentChat({ userId, userPlan, onBack, onUpgrade, initialVmid, initialSessionId }: AgentChatProps) {
  const { user } = useAuth();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRecovering, setIsRecovering] = useState(true);
  const [idToken, setIdToken] = useState<string>("");
  const [statusText, setStatusText] = useState("Checking for machines…");
  const xtermRef = useRef<any>(null);

  // ── Chat State ──
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<{ role: string; content: string }[]>([]);

  // ── Right Panel State ──
  const [rightTab, setRightTab] = useState<"terminal" | "files">("terminal");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Mobile State ──
  const [mobileView, setMobileView] = useState<"chat" | "computer">("chat");

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

  // ── Session Recovery ──
  useEffect(() => {
    const recover = async () => {
      if (initialVmid && initialSessionId) {
        setSession({ sessionId: initialSessionId, vmid: initialVmid, status: "running", createdAt: Date.now() });
        saveSessionLocal({ vmid: initialVmid, sessionId: initialSessionId, userId });
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
            setSession({
              sessionId: match.sessionId || saved.sessionId,
              vmid: match.vmid,
              status: match.status,
              containerIP: match.containerIP,
              createdAt: match.createdAt || Date.now(),
            });
            if (match.status !== "running") {
              pollSessionStatus(match.sessionId || saved.sessionId);
            }
            setIsRecovering(false);
            return;
          }
        } catch {}
        clearSessionLocal();
      }
      setIsRecovering(false);
      window.setTimeout(() => {
        if (!initialVmid && !loadSessionLocal()) {
          createSession();
        }
      }, 500);
    };
    recover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Session Management ──
  const createSession = async () => {
    setIsCreating(true);
    setStatusText("Starting machine…");
    try {
      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ userId, userPlan }),
      });
      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        vmid: data.vmid,
        status: data.status,
        containerIP: data.containerIP,
        createdAt: Date.now(),
      });
      saveSessionLocal({ vmid: data.vmid, sessionId: data.sessionId, userId });
      if (data.status !== "running") {
        pollSessionStatus(data.sessionId);
      }
    } catch (err: any) {
      setStatusText(`Failed: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const pollSessionStatus = useCallback(async (sessionId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/agent/session?userId=${userId}&idToken=${encodeURIComponent(idToken)}`);
        const data = await res.json();
        const match = data.sessions?.find((s: any) => s.sessionId === sessionId);
        if (match) {
          setSession(prev => prev ? { ...prev, status: match.status, containerIP: match.containerIP } : prev);
          if (match.status === "running") return;
        }
      } catch {}
      setTimeout(poll, 3000);
    };
    poll();
  }, [userId, idToken]);

  const endSession = async () => {
    if (!session) return;
    try {
      await fetch("/api/agent/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vmid: session.vmid, sessionId: session.sessionId, userId }),
      });
    } catch {}
    setSession(null);
    setEvents([]);
    setConversationMessages([]);
    clearSessionLocal();
  };

  const getUptime = () => {
    if (!session?.createdAt) return "—";
    const mins = Math.floor((Date.now() - session.createdAt) / 60000);
    if (mins < 1) return "< 1m";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // ── Chat: Send Message to AI Agent ──
  const sendMessage = useCallback(async (message: string) => {
    if (!session || session.status !== "running" || isProcessing) return;

    // Add user message to events
    const userEvent: AgentEvent = {
      id: `user-${Date.now()}`,
      type: "user",
      content: message,
      timestamp: Date.now(),
    };
    setEvents(prev => [...prev, userEvent]);

    // Add to conversation history
    const newMessages = [
      ...conversationMessages,
      { role: "user", content: message },
    ];
    setConversationMessages(newMessages);

    setIsProcessing(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vmid: session.vmid,
          sessionId: session.sessionId,
          messages: newMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Connection failed" }));
        setEvents(prev => [...prev, {
          id: `error-${Date.now()}`,
          type: "response",
          content: `⚠️ ${err.error || "Failed to connect to agent."}`,
          timestamp: Date.now(),
        }]);
        setIsProcessing(false);
        return;
      }

      // Stream SSE events
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastResponseId = "";
      let accumulatedResponse = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            const eventId = `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            if (event.type === "response") {
              // Accumulate response text into a single message
              accumulatedResponse += event.content;
              if (!lastResponseId) {
                lastResponseId = eventId;
                setEvents(prev => [...prev, {
                  id: lastResponseId,
                  type: "response",
                  content: accumulatedResponse,
                  timestamp: Date.now(),
                  isStreaming: true,
                }]);
              } else {
                setEvents(prev => prev.map(e =>
                  e.id === lastResponseId
                    ? { ...e, content: accumulatedResponse, isStreaming: true }
                    : e
                ));
              }
            } else {
              // Non-response events reset the response accumulator
              if (lastResponseId) {
                setEvents(prev => prev.map(e =>
                  e.id === lastResponseId ? { ...e, isStreaming: false } : e
                ));
                lastResponseId = "";
                accumulatedResponse = "";
              }

              setEvents(prev => [...prev, {
                id: eventId,
                type: event.type,
                content: event.content,
                exitCode: event.exitCode,
                timestamp: Date.now(),
                isStreaming: event.type === "status",
              }]);
            }
          } catch {}
        }
      }

      // Finalize streaming
      if (lastResponseId) {
        setEvents(prev => prev.map(e =>
          e.id === lastResponseId ? { ...e, isStreaming: false } : e
        ));
        // Add to conversation history
        setConversationMessages(prev => [
          ...prev,
          { role: "assistant", content: accumulatedResponse },
        ]);
      }
    } catch (err: any) {
      setEvents(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: "response",
        content: `⚠️ Network error: ${err.message}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [session, isProcessing, conversationMessages]);

  // ── Render ──
  return (
    <div className="flex-1 w-full flex flex-col h-full bg-[#09090b] text-white overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#0d0d14]/80 backdrop-blur-xl border-b border-white/[0.04] z-20">
        {/* Left — Back + Status */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white/90">
                🐉 Draco Agent
              </span>
              {session && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  session.status === "running"
                    ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15"
                    : session.status === "creating"
                    ? "bg-yellow-500/10 text-yellow-400/80 border border-yellow-500/15"
                    : "bg-red-500/10 text-red-400/80 border border-red-500/15"
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
                <span className="flex items-center gap-1"><Cpu size={9} />CT {session.vmid}</span>
              </div>
            )}
          </div>
        </div>

        {/* Center — Mobile View Switcher */}
        {session?.status === "running" && (
          <div className="flex md:hidden items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            <button
              onClick={() => setMobileView("chat")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mobileView === "chat" ? "bg-purple-600/30 text-purple-300" : "text-white/30"
              }`}
            >
              <MessageSquare size={14} />
            </button>
            <button
              onClick={() => setMobileView("computer")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mobileView === "computer" ? "bg-purple-600/30 text-purple-300" : "text-white/30"
              }`}
            >
              <Monitor size={14} />
            </button>
          </div>
        )}

        {/* Right — End Session / Start */}
        <div className="flex items-center gap-2">
          {!session ? (
            <button
              onClick={createSession}
              disabled={isCreating || isRecovering}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isCreating || isRecovering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {isRecovering ? "Checking…" : "Start Machine"}
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

      {/* ── Main Content ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {session?.status === "running" ? (
          <>
            {/* ═══ LEFT PANEL: Chat ═══ */}
            <div className={`flex flex-col border-r border-white/[0.04] bg-[#09090b] ${
              isFullscreen ? "hidden" : ""
            } ${mobileView === "computer" ? "hidden md:flex" : "flex"} ${
              isFullscreen ? "" : "w-full md:w-[45%] lg:w-[42%]"
            }`}>
              {/* Chat Messages */}
              <AgentMessages
                events={events}
                vmid={session.vmid}
                idToken={idToken}
              />

              {/* Chat Input */}
              <AgentInput
                onSend={sendMessage}
                disabled={session.status !== "running"}
                isProcessing={isProcessing}
              />
            </div>

            {/* ═══ RIGHT PANEL: Computer ═══ */}
            <div className={`flex flex-col bg-[#0a0a12] ${
              isFullscreen ? "w-full" : ""
            } ${mobileView === "chat" ? "hidden md:flex" : "flex"} ${
              isFullscreen ? "" : "w-full md:flex-1"
            }`}>
              {/* Tab Bar */}
              <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#0d0d14] border-b border-white/[0.04]">
                <div className="flex items-center gap-1">
                  {/* macOS dots */}
                  <div className="flex gap-1.5 mr-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f7768e]/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#e0af68]/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9ece6a]/40" />
                  </div>

                  {/* Tabs */}
                  <button
                    onClick={() => setRightTab("terminal")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      rightTab === "terminal"
                        ? "bg-white/[0.06] text-white/80"
                        : "text-white/25 hover:text-white/50"
                    }`}
                  >
                    <TerminalIcon size={12} />
                    Terminal
                  </button>
                  <button
                    onClick={() => setRightTab("files")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      rightTab === "files"
                        ? "bg-white/[0.06] text-white/80"
                        : "text-white/25 hover:text-white/50"
                    }`}
                  >
                    <FolderOpen size={12} />
                    Files
                  </button>
                </div>

                {/* Fullscreen toggle */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-white/20 hover:text-white/50 transition-all hidden md:block"
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                {rightTab === "terminal" ? (
                  <XTerminal
                    ref={xtermRef}
                    vmid={session.vmid}
                    idToken={idToken}
                    fontSize={13}
                    autoFocus={false}
                  />
                ) : (
                  <WorkspaceFiles vmid={session.vmid} idToken={idToken || ''} />
                )}
              </div>
            </div>
          </>
        ) : (
          /* ═══ BOOT / LOADING STATE ═══ */
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              {isRecovering || isCreating || session?.status === "creating" ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-emerald-500/10 border border-purple-500/10 flex items-center justify-center mb-4 mx-auto">
                    <Loader2 size={28} className="text-purple-400 animate-spin" />
                  </div>
                  <h3 className="text-lg font-bold text-white/80 mb-2">
                    {isRecovering ? "Reconnecting…" : "Booting Machine"}
                  </h3>
                  <p className="text-sm text-white/25 max-w-sm">
                    {session?.status === "creating"
                      ? "Your Linux container is starting up. This usually takes a moment."
                      : statusText}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/10 flex items-center justify-center mb-6 mx-auto">
                    <span className="text-4xl">🐉</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Draco Agent</h3>
                  <p className="text-sm text-white/25 max-w-md mb-8 leading-relaxed">
                    Your autonomous AI engineer with a live Linux workspace.<br />
                    Tell it what to build — it plans, codes, and delivers.
                  </p>
                  <button
                    onClick={createSession}
                    disabled={isCreating}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-xl shadow-purple-500/15 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    Start Session
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
