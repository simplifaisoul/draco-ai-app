"use client";

import { useRef, useEffect, memo } from "react";
import {
  Terminal, CheckCircle2, XCircle, Loader2, Download,
  Sparkles, Cpu, FileText, Image as ImageIcon,
  Archive, Code2, ChevronRight, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// ── Types ──
export interface AgentEvent {
  id: string;
  type: "response" | "command" | "output" | "status" | "artifact" | "user";
  content: string;
  exitCode?: number;
  timestamp: number;
  isStreaming?: boolean;
}

interface AgentMessagesProps {
  events: AgentEvent[];
  vmid?: number;
  idToken?: string;
}

// ── File icon helper ──
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": case "doc": case "docx": case "txt": case "md":
      return <FileText size={16} className="text-blue-400" />;
    case "png": case "jpg": case "jpeg": case "gif": case "svg":
      return <ImageIcon size={16} className="text-purple-400" />;
    case "zip": case "tar": case "gz":
      return <Archive size={16} className="text-amber-400" />;
    case "js": case "ts": case "jsx": case "tsx": case "py": case "json": case "html": case "css":
      return <Code2 size={16} className="text-emerald-400" />;
    default:
      return <FileText size={16} className="text-white/40" />;
  }
}

// ── Markdown renderer ──
function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="agent-markdown">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

// ── Individual event renderers ──
const UserMessage = memo(({ content }: { content: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="flex justify-end"
  >
    <div className="max-w-[75%] px-5 py-3.5 rounded-2xl rounded-br-lg bg-gradient-to-br from-[#6c3bff]/25 to-[#4f46e5]/15 border border-[#6c3bff]/20 backdrop-blur-sm">
      <p className="text-[14px] text-white/90 leading-relaxed">{content}</p>
    </div>
  </motion.div>
));
UserMessage.displayName = "UserMessage";

const StatusPill = memo(({ content, isStreaming }: { content: string; isStreaming?: boolean }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex items-center justify-center py-1"
  >
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05]">
      {isStreaming !== false ? (
        <div className="relative flex items-center justify-center w-3.5 h-3.5">
          <div className="absolute w-3.5 h-3.5 rounded-full bg-purple-500/20 animate-ping" />
          <div className="w-2 h-2 rounded-full bg-purple-500/80" />
        </div>
      ) : (
        <Sparkles size={12} className="text-purple-400/60" />
      )}
      <span className="text-[11px] font-medium text-white/35 tracking-wide">{content}</span>
    </div>
  </motion.div>
));
StatusPill.displayName = "StatusPill";

const CommandCard = memo(({ content, exitCode, output }: { content: string; exitCode?: number; output?: string }) => {
  const success = exitCode === 0 || exitCode === undefined;
  const hasOutput = output && output.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pl-8"
    >
      <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-[#0c0c16]/80 backdrop-blur-sm">
        {/* Command header */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.02]">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/10">
            <Terminal size={11} className="text-emerald-400/70" />
          </div>
          <code className="text-[12px] text-emerald-300/70 font-mono flex-1 truncate leading-none">
            {content}
          </code>
          {exitCode !== undefined && (
            <div className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md ${
              success
                ? "bg-emerald-500/8 text-emerald-400/60"
                : "bg-red-500/10 text-red-400/70"
            }`}>
              {success ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
              {exitCode}
            </div>
          )}
        </div>

        {/* Output */}
        {hasOutput && (
          <div className="px-4 py-2.5 border-t border-white/[0.04] max-h-[180px] overflow-y-auto custom-scrollbar">
            <pre className="text-[11px] font-mono text-white/35 whitespace-pre-wrap break-all leading-[1.6]">
              {output!.length > 1500 ? output!.slice(0, 1500) + "\n...(truncated)" : output}
            </pre>
          </div>
        )}
      </div>
    </motion.div>
  );
});
CommandCard.displayName = "CommandCard";

const ArtifactCard = memo(({ content, vmid, idToken }: { content: string; vmid?: number; idToken?: string }) => {
  const parts = content.split(":");
  const filename = parts[0] || "file";
  const filepath = parts.slice(1).join(":") || filename;
  const downloadUrl = vmid
    ? `/api/agent/download?vmid=${vmid}&path=${encodeURIComponent(filepath)}&token=${encodeURIComponent(idToken || "")}`
    : "#";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pl-8"
    >
      <a
        href={downloadUrl}
        download={filename}
        className="group flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-[#6c3bff]/[0.06] to-[#4f46e5]/[0.03] border border-[#6c3bff]/15 hover:border-[#6c3bff]/30 hover:from-[#6c3bff]/[0.10] transition-all duration-200 cursor-pointer"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#6c3bff]/10 border border-[#6c3bff]/10 group-hover:border-[#6c3bff]/20 transition-colors">
          {getFileIcon(filename)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/85 truncate">{filename}</p>
          <p className="text-[10px] text-white/25 font-mono truncate mt-0.5">{filepath}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6c3bff]/10 text-[#6c3bff]/0 group-hover:text-[#a78bfa] border border-transparent group-hover:border-[#6c3bff]/20 transition-all text-xs font-medium">
          <Download size={13} />
          <span>Download</span>
        </div>
      </a>
    </motion.div>
  );
});
ArtifactCard.displayName = "ArtifactCard";

const AIResponse = memo(({ content, isStreaming }: { content: string; isStreaming?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="flex gap-3.5"
  >
    {/* Avatar */}
    <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#6c3bff]/20 to-[#4f46e5]/10 border border-[#6c3bff]/10 flex items-center justify-center mt-0.5">
      <span className="text-sm">🐉</span>
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0 pt-1">
      <MessageMarkdown content={content} />
      {isStreaming && (
        <span className="inline-block w-[3px] h-[18px] bg-[#6c3bff]/70 animate-pulse rounded-full ml-1 -mb-0.5" />
      )}
    </div>
  </motion.div>
));
AIResponse.displayName = "AIResponse";

// ── Main Component ──
export default function AgentMessages({ events, vmid, idToken }: AgentMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Only auto-scroll if user is near bottom (within 200px)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [events]);

  const grouped = groupEvents(events);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[720px] mx-auto px-5 py-8 space-y-5">
        {grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5">
            {/* Dragon emblem */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#6c3bff]/15 to-[#4f46e5]/10 border border-[#6c3bff]/10 flex items-center justify-center shadow-2xl shadow-[#6c3bff]/5">
                <span className="text-4xl drop-shadow-lg">🐉</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="space-y-2"
            >
              <h2 className="text-xl font-bold text-white/90 tracking-tight">What can I build for you?</h2>
              <p className="text-sm text-white/25 max-w-md leading-relaxed">
                I'm an autonomous engineer with a live Linux machine.<br />
                I'll plan, code, test, and deliver — you just watch.
              </p>
            </motion.div>

            {/* Suggestion chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-2 max-w-lg mt-2"
            >
              {[
                "Build a REST API with Express",
                "Create a landing page",
                "Set up a Python data pipeline",
                "Deploy a static site with Nginx",
              ].map((suggestion) => (
                <div
                  key={suggestion}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/30 hover:text-white/50 hover:bg-white/[0.05] hover:border-white/[0.10] transition-all cursor-default select-none"
                >
                  {suggestion}
                </div>
              ))}
            </motion.div>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {grouped.map((event) => {
            switch (event.type) {
              case "user":
                return <UserMessage key={event.id} content={event.content} />;
              case "status":
                return <StatusPill key={event.id} content={event.content} isStreaming={event.isStreaming} />;
              case "command":
                return (
                  <CommandCard
                    key={event.id}
                    content={event.content}
                    exitCode={event.exitCode}
                    output={(event as any)._output}
                  />
                );
              case "artifact":
                return <ArtifactCard key={event.id} content={event.content} vmid={vmid} idToken={idToken} />;
              case "response":
                return <AIResponse key={event.id} content={event.content} isStreaming={event.isStreaming} />;
              default:
                return null;
            }
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Group consecutive command + output events for cleaner rendering.
 */
function groupEvents(events: AgentEvent[]): AgentEvent[] {
  const result: AgentEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === "command") {
      let combinedOutput = "";
      let exitCode: number | undefined;
      let j = i + 1;
      while (j < events.length && events[j].type === "output") {
        combinedOutput += events[j].content;
        if (events[j].exitCode !== undefined) exitCode = events[j].exitCode;
        j++;
      }
      result.push({ ...event, exitCode, _output: combinedOutput || undefined } as any);
      i = j - 1;
    } else if (event.type === "output") {
      continue;
    } else {
      result.push(event);
    }
  }
  return result;
}
