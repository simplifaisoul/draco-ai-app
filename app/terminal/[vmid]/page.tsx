"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/app/lib/AuthContext";

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
  const router = useRouter();
  const vmid = parseInt(params.vmid as string);
  const { user, loading: authLoading } = useAuth();
  const [commandCount, setCommandCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [idToken, setIdToken] = useState<string>("");

  // AUTH GATE: redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Get Firebase ID token for API calls
  useEffect(() => {
    if (user) {
      user.getIdToken().then((token: string) => {
        setIdToken(token);
      });

      // Refresh token every 50 minutes (tokens expire after 60 min)
      const interval = setInterval(() => {
        user.getIdToken(true).then((token: string) => {
          setIdToken(token);
        });
      }, 50 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user]);

  // Show loading while checking auth
  if (authLoading || !user) {
    return (
      <div className="h-screen bg-[#1a1b26] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <div className="w-5 h-5 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-sm font-mono">Authenticating...</span>
        </div>
      </div>
    );
  }

  // Wait for token
  if (!idToken) {
    return (
      <div className="h-screen bg-[#1a1b26] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <div className="w-5 h-5 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-sm font-mono">Securing connection...</span>
        </div>
      </div>
    );
  }

  const statusConfig = {
    connecting: { color: "yellow", label: "Connecting", pulse: true },
    connected: { color: "green", label: "Connected", pulse: true },
    disconnected: { color: "red", label: "Disconnected", pulse: false },
    error: { color: "red", label: "Error", pulse: false },
  };

  const status = statusConfig[connectionStatus];

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
            <span className={`text-${status.color}-400/70`}>●</span>
            <span>root@draco-ct{vmid}</span>
            <span className="text-white/15">—</span>
            <span className="text-white/25">/workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-${status.color}-400/60 bg-${status.color}-500/5 border border-${status.color}-500/10`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-${status.color}-400 ${status.pulse ? "animate-pulse" : ""}`} />
            {status.label}
          </span>
          <span className="text-white/20">CT {vmid}</span>
          {user.email && (
            <span className="text-white/15 hidden sm:inline">{user.email}</span>
          )}
        </div>
      </div>

      {/* Terminal body — xterm.js with real PTY */}
      <div className="flex-1 min-h-0">
        <XTerminal
          vmid={vmid}
          idToken={idToken}
          fontSize={14}
          autoFocus={true}
          onCommand={() => setCommandCount((c) => c + 1)}
          onConnectionChange={setConnectionStatus}
        />
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#111118] border-t border-white/5 text-[10px] text-white/20 font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span>CT {vmid}</span>
          <span>Ubuntu 22.04</span>
          <span>Real-time PTY</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Full interactive shell</span>
          <span className="text-purple-400/40">Draco Terminal v3.0</span>
        </div>
      </div>
    </div>
  );
}
