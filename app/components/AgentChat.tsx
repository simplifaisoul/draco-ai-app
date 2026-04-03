"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Loader2, ArrowLeft, Square, Cpu, Wifi, Clock, Play,
  Zap, Circle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/lib/AuthContext";
import AgentMessages, { AgentEvent } from "./AgentMessages";
import AgentInput from "./AgentInput";

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

  // ── Chat State ──
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<{ role: string; content: string }[]>([]);

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

  // ── Chat: Send to AI Agent ──
  const sendMessage = useCallback(async (message: string) => {
    if (!session || session.status !== "running" || isProcessing) return;

    const userEvent: AgentEvent = {
      id: `user-${Date.now()}`,
      type: "user",
      content: message,
      timestamp: Date.now(),
    };
    setEvents(prev => [...prev, userEvent]);

    const newMessages = [...conversationMessages, { role: "user", content: message }];
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

      if (lastResponseId) {
        setEvents(prev => prev.map(e =>
          e.id === lastResponseId ? { ...e, isStreaming: false } : e
        ));
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

  // ── RENDER ──
  return (
    <div className="flex-1 w-full flex flex-col h-full bg-[#09090b] text-white overflow-hidden">

      {/* ═══ MINIMAL TOP BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04] bg-[#09090b]/95 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-[14px] font-semibold text-white/85 tracking-tight">Draco Agent</span>
            {session?.status === "running" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/8 border border-emerald-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-400/70">Live</span>
              </div>
            )}
            {session?.status === "creating" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/8 border border-amber-500/10">
                <Loader2 size={10} className="animate-spin text-amber-400/70" />
                <span className="text-[10px] font-medium text-amber-400/70">Booting</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side — minimal session info + controls */}
        <div className="flex items-center gap-3">
          {session?.status === "running" && (
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/15 font-mono">
              <span className="flex items-center gap-1"><Cpu size={9} />CT {session.vmid}</span>
              <span className="flex items-center gap-1"><Clock size={9} />{getUptime()}</span>
            </div>
          )}

          {!session ? (
            <button
              onClick={createSession}
              disabled={isCreating || isRecovering}
              className="px-4 py-2 rounded-xl bg-[#6c3bff] hover:bg-[#7c4dff] text-white text-xs font-semibold shadow-lg shadow-[#6c3bff]/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isCreating || isRecovering ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {isRecovering ? "Checking…" : "Start Session"}
            </button>
          ) : (
            <button
              onClick={endSession}
              className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/15 text-white/25 hover:text-red-400 text-[11px] font-medium transition-all flex items-center gap-1.5"
            >
              <Square size={10} /> End
            </button>
          )}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      {session?.status === "running" ? (
        /* ── Active Session: Full-Page Chat ── */
        <>
          <AgentMessages
            events={events}
            vmid={session.vmid}
            idToken={idToken}
          />
          <AgentInput
            onSend={sendMessage}
            disabled={session.status !== "running"}
            isProcessing={isProcessing}
          />
        </>
      ) : (
        /* ── Boot / Loading State ── */
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center px-6"
          >
            {isRecovering || isCreating || session?.status === "creating" ? (
              <>
                {/* Boot animation */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#6c3bff]/15 to-[#4f46e5]/10 border border-[#6c3bff]/10 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={28} className="text-[#6c3bff]/60 animate-spin" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white/80 mb-2 tracking-tight">
                  {isRecovering ? "Reconnecting…" : "Booting your machine"}
                </h3>
                <p className="text-sm text-white/20 max-w-sm mx-auto leading-relaxed">
                  {session?.status === "creating"
                    ? "Spinning up a Linux container. This takes a moment."
                    : statusText}
                </p>

                {/* Boot steps animation */}
                <div className="mt-6 space-y-2 text-left max-w-[280px] mx-auto">
                  {["Allocating compute", "Networking", "Installing tools"].map((step, i) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.8 + 0.3 }}
                      className="flex items-center gap-2.5 text-xs text-white/20"
                    >
                      <div className="w-4 h-4 rounded-full bg-[#6c3bff]/10 border border-[#6c3bff]/15 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#6c3bff]/40 animate-pulse" />
                      </div>
                      {step}
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Welcome state */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#6c3bff]/12 to-[#4f46e5]/8 border border-[#6c3bff]/10 shadow-2xl shadow-[#6c3bff]/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl drop-shadow-xl">🐉</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0d0d14] border-2 border-[#09090b] flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-white/10 flex items-center justify-center">
                      <Circle size={6} className="text-white/20" />
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white/90 tracking-tight mb-3">Draco Agent</h2>
                <p className="text-sm text-white/20 max-w-md mx-auto mb-8 leading-relaxed">
                  An autonomous AI engineer with a live Linux machine.<br />
                  Give it a task — it plans, builds, and delivers.
                </p>

                <button
                  onClick={createSession}
                  disabled={isCreating}
                  className="px-8 py-3.5 rounded-2xl bg-[#6c3bff] hover:bg-[#7c4dff] text-white text-sm font-semibold shadow-2xl shadow-[#6c3bff]/25 transition-all flex items-center gap-2.5 mx-auto disabled:opacity-50 hover:shadow-[#6c3bff]/35"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Start Session
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
