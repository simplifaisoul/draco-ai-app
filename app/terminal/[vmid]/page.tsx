"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  content: string;
  timestamp: string;
}

export default function FullTerminalPage() {
  const params = useParams();
  const vmid = params.vmid as string;
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [connected, setConnected] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount and on click
  useEffect(() => {
    inputRef.current?.focus();
    setConnected(true);
    setLines([
      {
        type: "system",
        content: `╔══════════════════════════════════════════════════════════╗`,
        timestamp: new Date().toISOString(),
      },
      {
        type: "system",
        content: `║  Draco Terminal — CT ${vmid}                              ║`,
        timestamp: new Date().toISOString(),
      },
      {
        type: "system",
        content: `║  Ubuntu 22.04 LTS • Full root access • /workspace        ║`,
        timestamp: new Date().toISOString(),
      },
      {
        type: "system",
        content: `╚══════════════════════════════════════════════════════════╝`,
        timestamp: new Date().toISOString(),
      },
      {
        type: "system",
        content: "",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [vmid]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const handleFocusTerminal = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const runCommand = async (cmd: string) => {
    if (!cmd.trim() || running) return;

    setCommandHistory((prev) => [cmd, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);

    // Show the input line
    setLines((prev) => [
      ...prev,
      {
        type: "input",
        content: cmd,
        timestamp: new Date().toISOString(),
      },
    ]);
    setInput("");
    setRunning(true);

    try {
      const res = await fetch("/api/agent/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vmid: parseInt(vmid),
          command: cmd,
          userId: "terminal-user",
        }),
      });

      const data = await res.json();

      if (data.error) {
        setLines((prev) => [
          ...prev,
          {
            type: "error",
            content: data.error,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        if (data.stdout) {
          setLines((prev) => [
            ...prev,
            {
              type: "output",
              content: data.stdout,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        if (data.stderr) {
          setLines((prev) => [
            ...prev,
            {
              type: "error",
              content: data.stderr,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
        if (!data.stdout && !data.stderr) {
          setLines((prev) => [
            ...prev,
            {
              type: "output",
              content: "(no output)",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (err) {
      setLines((prev) => [
        ...prev,
        {
          type: "error",
          content: `Connection error: ${err}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <a
              href="/"
              className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors cursor-pointer"
              title="Close"
            />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
            <span className="text-green-400/70">●</span>
            <span>root@draco-ct{vmid}</span>
            <span className="text-white/15">—</span>
            <span className="text-white/25">/workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
              connected
                ? "text-green-400/60 bg-green-500/5 border border-green-500/10"
                : "text-red-400/60 bg-red-500/5 border border-red-500/10"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
          <span className="text-white/20">CT {vmid}</span>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm cursor-text"
        onClick={handleFocusTerminal}
        style={{
          background:
            "linear-gradient(180deg, #0a0a0f 0%, #0d0d14 50%, #0a0a0f 100%)",
        }}
      >
        {/* Lines */}
        {lines.map((line, i) => (
          <div key={i} className="mb-0.5">
            {line.type === "input" ? (
              <div className="flex items-start gap-0">
                <span className="text-green-400/80 select-none">
                  root@draco
                </span>
                <span className="text-white/30 select-none">:</span>
                <span className="text-blue-400/80 select-none">~</span>
                <span className="text-white/40 select-none mr-2">$</span>
                <span className="text-white/90">{line.content}</span>
              </div>
            ) : line.type === "system" ? (
              <div className="text-purple-400/60">{line.content}</div>
            ) : line.type === "error" ? (
              <pre className="text-red-400/70 whitespace-pre-wrap break-all leading-relaxed">
                {line.content}
              </pre>
            ) : (
              <pre className="text-white/60 whitespace-pre-wrap break-all leading-relaxed">
                {line.content}
              </pre>
            )}
          </div>
        ))}

        {/* Active input */}
        <div className="flex items-start gap-0 mt-0.5">
          <span className="text-green-400/80 select-none">root@draco</span>
          <span className="text-white/30 select-none">:</span>
          <span className="text-blue-400/80 select-none">~</span>
          <span className="text-white/40 select-none mr-2">$</span>
          {running ? (
            <span className="text-white/30 animate-pulse">running...</span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-white/90 caret-green-400"
              style={{ caretColor: "#4ade80" }}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
          )}
        </div>

        <div ref={terminalEndRef} />
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#111118] border-t border-white/5 text-[10px] text-white/20 font-mono">
        <div className="flex items-center gap-4">
          <span>CT {vmid}</span>
          <span>Ubuntu 22.04</span>
          <span>{lines.filter((l) => l.type === "input").length} commands</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ctrl+L to clear</span>
          <span>↑↓ for history</span>
          <span className="text-purple-400/40">Draco Terminal v1.0</span>
        </div>
      </div>
    </div>
  );
}
