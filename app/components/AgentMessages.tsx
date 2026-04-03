"use client";

import { useRef, useEffect, memo } from "react";
import {
  Terminal, CheckCircle2, XCircle, Loader2, Download,
  ChevronDown, ChevronRight, Sparkles, Cpu, FileText
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

// ── Markdown renderer with code blocks ──
function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-p:my-1.5 prose-p:leading-relaxed
      prose-headings:text-white/90 prose-headings:font-semibold
      prose-code:text-purple-300 prose-code:bg-white/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-mono
      prose-pre:bg-[#0d0d14] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl
      prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
      prose-strong:text-white/90
      prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1
    ">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

// ── Individual event renderers ──
const UserMessage = memo(({ content }: { content: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex justify-end"
  >
    <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-purple-600/30 to-indigo-600/20 border border-purple-500/15 text-sm text-white/90 leading-relaxed">
      {content}
    </div>
  </motion.div>
));
UserMessage.displayName = "UserMessage";

const StatusPill = memo(({ content, isStreaming }: { content: string; isStreaming?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="flex items-center justify-center"
  >
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-white/40">
      {isStreaming ? (
        <Loader2 size={12} className="animate-spin text-purple-400" />
      ) : (
        <Sparkles size={12} className="text-purple-400" />
      )}
      {content}
    </div>
  </motion.div>
));
StatusPill.displayName = "StatusPill";

const CommandCard = memo(({ content, exitCode, output }: { content: string; exitCode?: number; output?: string }) => {
  const success = exitCode === 0 || exitCode === undefined;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-0"
    >
      {/* Command Header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl bg-[#0a0a14] border border-white/[0.06] border-b-0">
        <Terminal size={13} className="text-emerald-400/60 shrink-0" />
        <code className="text-xs text-emerald-300/80 font-mono flex-1 truncate">{content}</code>
        {exitCode !== undefined && (
          <span className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
            success
              ? "bg-emerald-500/10 text-emerald-400/70"
              : "bg-red-500/10 text-red-400/70"
          }`}>
            {success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {exitCode}
          </span>
        )}
      </div>
      {/* Output */}
      {output && (
        <div className="px-3 py-2 rounded-b-xl bg-[#07070e] border border-white/[0.06] border-t border-white/[0.03] max-h-[200px] overflow-y-auto custom-scrollbar">
          <pre className="text-[11px] font-mono text-white/50 whitespace-pre-wrap break-all leading-relaxed">
            {output.length > 2000 ? output.slice(0, 2000) + "\n...(truncated)" : output}
          </pre>
        </div>
      )}
    </motion.div>
  );
});
CommandCard.displayName = "CommandCard";

const ArtifactCard = memo(({ content, vmid, idToken }: { content: string; vmid?: number; idToken?: string }) => {
  const [filename, filepath] = content.split(":");
  const downloadUrl = vmid
    ? `/api/agent/download?vmid=${vmid}&path=${encodeURIComponent(filepath || filename)}&token=${encodeURIComponent(idToken || '')}`
    : "#";

  return (
    <motion.a
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      href={downloadUrl}
      download={filename}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/[0.06] to-indigo-500/[0.04] border border-purple-500/15 hover:border-purple-500/30 transition-all cursor-pointer"
    >
      <div className="p-2 rounded-lg bg-purple-500/10">
        <FileText size={18} className="text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{filename}</p>
        <p className="text-[11px] text-white/30 font-mono truncate">{filepath}</p>
      </div>
      <div className="p-2 rounded-lg text-white/0 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-colors">
        <Download size={16} />
      </div>
    </motion.a>
  );
});
ArtifactCard.displayName = "ArtifactCard";

const AIResponse = memo(({ content, isStreaming }: { content: string; isStreaming?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex gap-3"
  >
    <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex items-center justify-center mt-0.5">
      <Cpu size={14} className="text-purple-400" />
    </div>
    <div className="flex-1 min-w-0 text-sm text-white/80 leading-relaxed">
      <MessageMarkdown content={content} />
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-purple-400/60 animate-pulse rounded-sm ml-0.5" />
      )}
    </div>
  </motion.div>
));
AIResponse.displayName = "AIResponse";

// ── Main Component ──
export default function AgentMessages({ events, vmid, idToken }: AgentMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Group consecutive commands + outputs together
  const groupedEvents = groupEvents(events);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar">
      {groupedEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/10 flex items-center justify-center">
            <span className="text-3xl">🐉</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white/80 mb-1">Draco Agent</h3>
            <p className="text-sm text-white/25 max-w-sm">
              Tell me what to build, debug, research, or deploy.<br />
              I have a live Linux machine ready to go.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {groupedEvents.map((event) => {
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
  );
}

/**
 * Group command + subsequent output events together for cleaner rendering.
 */
function groupEvents(events: AgentEvent[]): AgentEvent[] {
  const result: AgentEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === "command") {
      // Look ahead for the output event(s) that follow
      let combinedOutput = "";
      let exitCode: number | undefined;
      let j = i + 1;
      while (j < events.length && events[j].type === "output") {
        combinedOutput += events[j].content;
        if (events[j].exitCode !== undefined) exitCode = events[j].exitCode;
        j++;
      }
      const grouped = { ...event, exitCode, _output: combinedOutput || undefined } as any;
      result.push(grouped);
      i = j - 1; // Skip the output events we consumed
    } else if (event.type === "output") {
      // Standalone output (shouldn't happen after grouping, but just in case)
      continue;
    } else {
      result.push(event);
    }
  }
  return result;
}
