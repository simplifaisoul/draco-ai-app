"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from "react";

// Types for xterm.js (dynamic import)
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
  userId?: string;
  onCommand?: (cmd: string) => void;
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

const XTerminal = forwardRef<XTerminalRef, XTerminalProps>(
  ({ vmid, userId = "terminal-user", onCommand, className = "", fontSize = 14, autoFocus = true }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTermTerminal>(null);
    const fitRef = useRef<FitAddonType>(null);
    const inputBufferRef = useRef("");
    const commandHistoryRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isRunningRef = useRef(false);
    const [loaded, setLoaded] = useState(false);

    // Expose write methods to parent
    useImperativeHandle(ref, () => ({
      write: (data: string) => termRef.current?.write(data),
      writeln: (data: string) => termRef.current?.writeln(data),
      clear: () => termRef.current?.clear(),
      focus: () => termRef.current?.focus(),
    }));

    const writePrompt = useCallback(() => {
      if (termRef.current) {
        termRef.current.write("\r\n\x1b[1;32mroot@draco\x1b[0m:\x1b[1;34m~\x1b[0m$ ");
      }
    }, []);

    // Execute command via HTTP
    const execCommand = useCallback(
      async (cmd: string) => {
        if (isRunningRef.current) return;
        isRunningRef.current = true;

        try {
          const res = await fetch("/api/agent/exec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vmid, command: cmd, userId }),
          });
          const data = await res.json();

          if (data.error) {
            termRef.current?.write(`\r\n\x1b[31m${data.error}\x1b[0m`);
          } else {
            if (data.stdout) {
              // Write each line properly
              const lines = data.stdout.split("\n");
              for (const line of lines) {
                termRef.current?.write(`\r\n${line}`);
              }
            }
            if (data.stderr) {
              const lines = data.stderr.split("\n");
              for (const line of lines) {
                termRef.current?.write(`\r\n\x1b[31m${line}\x1b[0m`);
              }
            }
            if (!data.stdout && !data.stderr) {
              // No output — just show prompt
            }
          }
        } catch (err: any) {
          termRef.current?.write(`\r\n\x1b[31mConnection error: ${err.message}\x1b[0m`);
        } finally {
          isRunningRef.current = false;
          writePrompt();

          // Fire callback
          if (onCommand) onCommand(cmd);
        }
      },
      [vmid, userId, writePrompt, onCommand]
    );

    // Initialize xterm.js
    useEffect(() => {
      if (!containerRef.current) return;

      let term: XTermTerminal;
      let fitAddon: FitAddonType;
      let disposed = false;

      const init = async () => {
        // Dynamic import to avoid SSR issues
        const { Terminal } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");

        // CSS is imported via globals.css or loaded by xterm automatically

        if (disposed || !containerRef.current) return;

        term = new Terminal({
          theme: TOKYO_NIGHT_THEME,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          fontSize,
          lineHeight: 1.5,
          cursorBlink: true,
          cursorStyle: "bar",
          scrollback: 5000,
          allowTransparency: true,
          convertEol: true,
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitRef.current = fitAddon;

        // Welcome message
        term.write("\x1b[1;35m╔═══════════════════════════════════════════════════╗\x1b[0m\r\n");
        term.write(`\x1b[1;35m║\x1b[0m  \x1b[1;36mDraco Terminal\x1b[0m — CT ${vmid}                        \x1b[1;35m║\x1b[0m\r\n`);
        term.write("\x1b[1;35m║\x1b[0m  Ubuntu 22.04 LTS • Full root access               \x1b[1;35m║\x1b[0m\r\n");
        term.write("\x1b[1;35m╚═══════════════════════════════════════════════════╝\x1b[0m");
        writePrompt();

        // Handle keyboard input
        term.onData((data: string) => {
          if (isRunningRef.current) return;

          const code = data.charCodeAt(0);

          if (data === "\r") {
            // Enter
            const cmd = inputBufferRef.current.trim();
            inputBufferRef.current = "";
            historyIndexRef.current = -1;

            if (cmd) {
              commandHistoryRef.current.unshift(cmd);
              if (commandHistoryRef.current.length > 100) commandHistoryRef.current.pop();

              if (cmd === "clear") {
                term.clear();
                writePrompt();
              } else {
                execCommand(cmd);
              }
            } else {
              writePrompt();
            }
          } else if (data === "\x7f") {
            // Backspace
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              term.write("\b \b");
            }
          } else if (data === "\x1b[A") {
            // Arrow Up — history
            const history = commandHistoryRef.current;
            if (history.length > 0 && historyIndexRef.current < history.length - 1) {
              historyIndexRef.current++;
              const cmd = history[historyIndexRef.current];
              // Clear current input
              const clearLen = inputBufferRef.current.length;
              term.write("\b \b".repeat(clearLen));
              inputBufferRef.current = cmd;
              term.write(cmd);
            }
          } else if (data === "\x1b[D") {
            // Arrow Down — history
            if (historyIndexRef.current > 0) {
              historyIndexRef.current--;
              const cmd = commandHistoryRef.current[historyIndexRef.current];
              const clearLen = inputBufferRef.current.length;
              term.write("\b \b".repeat(clearLen));
              inputBufferRef.current = cmd;
              term.write(cmd);
            } else if (historyIndexRef.current === 0) {
              historyIndexRef.current = -1;
              const clearLen = inputBufferRef.current.length;
              term.write("\b \b".repeat(clearLen));
              inputBufferRef.current = "";
            }
          } else if (data === "\x0c") {
            // Ctrl+L — clear
            term.clear();
            writePrompt();
          } else if (code === 3) {
            // Ctrl+C
            inputBufferRef.current = "";
            term.write("^C");
            writePrompt();
          } else if (code >= 32) {
            // Printable characters
            inputBufferRef.current += data;
            term.write(data);
          }
        });

        if (autoFocus) term.focus();
        setLoaded(true);
      };

      init();

      // Resize handler
      const handleResize = () => {
        if (fitRef.current) {
          try {
            fitRef.current.fit();
          } catch {}
        }
      };
      window.addEventListener("resize", handleResize);

      // ResizeObserver for container size changes
      const observer = new ResizeObserver(() => handleResize());
      if (containerRef.current) observer.observe(containerRef.current);

      return () => {
        disposed = true;
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
        if (term) {
          try { term.dispose(); } catch {}
        }
        termRef.current = null;
        fitRef.current = null;
      };
    }, [vmid, userId, fontSize, autoFocus, execCommand, writePrompt]);

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
              Connecting...
            </div>
          </div>
        )}
      </div>
    );
  }
);

XTerminal.displayName = "XTerminal";
export default XTerminal;
