"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from "react";

type XTermTerminal = any;
type FitAddonType = any;

export interface XTerminalRef {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

interface XTerminalProps {
  vmid: number;
  idToken: string;
  onCommand?: (cmd: string) => void;
  onConnectionChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void;
  className?: string;
  fontSize?: number;
  autoFocus?: boolean;
}

const TOKYO_NIGHT_THEME = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  cursorAccent: "#1a1b26",
  selectionBackground: "#33467c",
  selectionForeground: "#c0caf5",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
};

/**
 * XTerminal — Real-time interactive terminal using SSE PTY streaming.
 * 
 * Architecture:
 * - GET /api/agent/terminal-ws → SSE stream of base64-encoded PTY output
 * - POST /api/agent/terminal-ws → Send base64-encoded stdin + resize events
 * - The server holds an SSH connection with `pct enter {vmid}` for a true shell
 * 
 * This means: tab completion, vim, htop, Ctrl+C, arrow keys, colors — everything works.
 */
const XTerminal = forwardRef<XTerminalRef, XTerminalProps>(
  ({ vmid, idToken, onCommand, onConnectionChange, className = "", fontSize = 14, autoFocus = true }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTermTerminal>(null);
    const fitRef = useRef<FitAddonType>(null);
    const sessionIdRef = useRef<string>("");
    const abortRef = useRef<AbortController | null>(null);
    const reconnectTimerRef = useRef<any>(null);
    const [loaded, setLoaded] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");

    // Track connection status
    const updateStatus = useCallback((status: "connecting" | "connected" | "disconnected" | "error") => {
      setConnectionStatus(status);
      onConnectionChange?.(status);
    }, [onConnectionChange]);

    // Expose write methods to parent
    useImperativeHandle(ref, () => ({
      write: (data: string) => termRef.current?.write(data),
      writeln: (data: string) => termRef.current?.writeln(data),
      clear: () => termRef.current?.clear(),
      focus: () => termRef.current?.focus(),
    }));

    // Send stdin input to the server
    const sendInput = useCallback(async (data: string) => {
      if (!sessionIdRef.current) return;
      
      try {
        await fetch("/api/agent/terminal-ws", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken || 'anonymous'}`,
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            input: btoa(data), // base64 encode
          }),
        });
      } catch (err) {
        console.error("[XTerminal] Failed to send input:", err);
      }
    }, [idToken]);

    // Send terminal resize to server
    const sendResize = useCallback(async (rows: number, cols: number) => {
      if (!sessionIdRef.current) return;
      
      try {
        await fetch("/api/agent/terminal-ws", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken || 'anonymous'}`,
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            resize: { rows, cols },
          }),
        });
      } catch {}
    }, [idToken]);

    // Connect to the SSE PTY stream
    const connectStream = useCallback(async (term: XTermTerminal) => {
      // Abort any existing connection
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      updateStatus("connecting");

      try {
        const res = await fetch(
          `/api/agent/terminal-ws?vmid=${vmid}&token=${encodeURIComponent(idToken || 'anonymous')}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Connection failed" }));
          term.write(`\r\n\x1b[31m${err.error || "Failed to connect"}\x1b[0m\r\n`);
          updateStatus("error");
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          updateStatus("error");
          return;
        }

        updateStatus("connected");
        const decoder = new TextDecoder();
        let buffer = "";

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

            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === "session") {
                // Store the session ID for stdin
                sessionIdRef.current = event.data;
              } else if (event.type === "output") {
                // Decode base64 PTY output and write to xterm
                const decoded = atob(event.data);
                term.write(decoded);
              } else if (event.type === "exit") {
                term.write("\r\n\x1b[33mSession ended.\x1b[0m\r\n");
                updateStatus("disconnected");
              } else if (event.type === "error") {
                term.write(`\r\n\x1b[31m${event.data}\x1b[0m\r\n`);
                updateStatus("error");
              }
            } catch {}
          }
        }

        // Stream ended
        updateStatus("disconnected");
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("[XTerminal] Stream error:", err);
        term.write(`\r\n\x1b[31mConnection lost: ${err.message}\x1b[0m\r\n`);
        updateStatus("disconnected");

        // Auto-reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          term.write("\r\n\x1b[33mReconnecting...\x1b[0m\r\n");
          connectStream(term);
        }, 3000);
      }
    }, [vmid, idToken, updateStatus]);

    // Initialize xterm.js and start PTY stream
    useEffect(() => {
      if (!containerRef.current || !idToken) return;

      let term: XTermTerminal;
      let fitAddon: FitAddonType;
      let disposed = false;

      const init = async () => {
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");

        if (disposed || !containerRef.current) return;

        term = new Terminal({
          theme: TOKYO_NIGHT_THEME,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          fontSize,
          lineHeight: 1.4,
          cursorBlink: true,
          cursorStyle: "bar",
          scrollback: 10000,
          allowTransparency: true,
          convertEol: false, // PTY handles EOL natively
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitRef.current = fitAddon;

        // ALL keyboard input goes to the server PTY — no client-side shell emulation
        term.onData((data: string) => {
          sendInput(data);
        });

        // Binary data (for special keys)
        term.onBinary?.((data: string) => {
          sendInput(data);
        });

        if (autoFocus) term.focus();
        setLoaded(true);

        // Start the PTY stream
        connectStream(term);
      };

      init();

      // Resize handler — tell server about terminal dimension changes
      const handleResize = () => {
        if (fitRef.current) {
          try {
            fitRef.current.fit();
            const term = termRef.current;
            if (term) {
              sendResize(term.rows, term.cols);
            }
          } catch {}
        }
      };
      window.addEventListener("resize", handleResize);

      const observer = new ResizeObserver(() => handleResize());
      if (containerRef.current) observer.observe(containerRef.current);

      return () => {
        disposed = true;
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
        if (abortRef.current) abortRef.current.abort();
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (term) {
          try { term.dispose(); } catch {}
        }
        termRef.current = null;
        fitRef.current = null;
      };
    }, [vmid, idToken, fontSize, autoFocus, connectStream, sendInput, sendResize]);

    return (
      <div className={`relative w-full h-full ${className}`}>
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ backgroundColor: TOKYO_NIGHT_THEME.background }}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b26]">
            <div className="flex items-center gap-2 text-sm text-white/30">
              <div className="w-4 h-4 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
              Initializing terminal...
            </div>
          </div>
        )}
        {/* Connection status overlay */}
        {loaded && connectionStatus === "connecting" && (
          <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Connecting...
          </div>
        )}
        {loaded && connectionStatus === "disconnected" && (
          <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            Disconnected — Reconnecting...
          </div>
        )}
        {loaded && connectionStatus === "error" && (
          <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            Connection Error
          </div>
        )}
      </div>
    );
  }
);

XTerminal.displayName = "XTerminal";
export default XTerminal;
