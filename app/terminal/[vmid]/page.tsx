"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with xterm.js
const XTerminal = dynamic(() => import("@/app/components/XTerminal"), {
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

export default function FullTerminalPage() {
  const params = useParams();
  const vmid = parseInt(params.vmid as string);
  const [commandCount, setCommandCount] = useState(0);

  return (
    <div className="h-screen bg-[#1a1b26] text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/5 shrink-0">
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
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-green-400/60 bg-green-500/5 border border-green-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Connected
          </span>
          <span className="text-white/20">CT {vmid}</span>
        </div>
      </div>

      {/* Terminal body — xterm.js */}
      <div className="flex-1 min-h-0">
        <XTerminal
          vmid={vmid}
          fontSize={14}
          autoFocus={true}
          onCommand={() => setCommandCount((c) => c + 1)}
        />
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#111118] border-t border-white/5 text-[10px] text-white/20 font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span>CT {vmid}</span>
          <span>Ubuntu 22.04</span>
          <span>{commandCount} commands</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ctrl+L to clear</span>
          <span>↑↓ for history</span>
          <span className="text-purple-400/40">Draco Terminal v2.0</span>
        </div>
      </div>
    </div>
  );
}
