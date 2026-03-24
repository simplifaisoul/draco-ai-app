"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server, Play, Square, RotateCcw, Trash2, Plus, Loader2,
  Terminal, Cpu, HardDrive, Wifi, Clock, AlertCircle, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Container {
  sessionId: string;
  vmid: number;
  status: string;
  containerIP: string | null;
  createdAt: number;
}

interface ContainerDashboardProps {
  userId: string;
  userPlan: string;
  onOpenTerminal: (vmid: number, sessionId: string) => void;
  onUpgrade: () => void;
}

export default function ContainerDashboard({
  userId,
  userPlan,
  onOpenTerminal,
  onUpgrade,
}: ContainerDashboardProps) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const maxContainers = 3;

  // Fetch containers
  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/session?userId=${userId}`);
      const data = await res.json();
      setContainers(data.sessions || []);
      setError("");
    } catch (err: any) {
      setError("Failed to fetch containers");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 8000);
    return () => clearInterval(interval);
  }, [fetchContainers]);

  // Create new container
  const createContainer = async () => {
    if (containers.length >= maxContainers) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userPlan }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Poll until ready
        setTimeout(fetchContainers, 3000);
        setTimeout(fetchContainers, 8000);
        setTimeout(fetchContainers, 15000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Container action (start, stop, reboot)
  const containerAction = async (vmid: number, action: string) => {
    setActionLoading(prev => ({ ...prev, [vmid]: action }));
    try {
      const res = await fetch("/api/agent/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vmid, action }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else await fetchContainers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[vmid];
        return next;
      });
    }
  };

  // Destroy container
  const destroyContainer = async (vmid: number, sessionId: string) => {
    if (!confirm(`Destroy container CT ${vmid}? All data will be lost.`)) return;
    setActionLoading(prev => ({ ...prev, [vmid]: "destroy" }));
    try {
      await fetch("/api/agent/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId, vmid }),
      });
      await fetchContainers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[vmid];
        return next;
      });
    }
  };

  const getUptime = (createdAt: number) => {
    const mins = Math.floor((Date.now() - createdAt) / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  if (userPlan === "free") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-600/20 to-fuchsia-600/20 border border-purple-500/20 flex items-center justify-center">
            <Server size={28} className="text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Container Dashboard</h2>
          <p className="text-white/30 text-sm mb-6">
            Manage up to 3 Linux containers. Create, start, stop, reboot, and destroy — full VPS control.
          </p>
          <button onClick={onUpgrade}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold shadow-lg transition-all">
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f0f14]">
      {/* Dashboard Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Server size={20} className="text-purple-400" />
              Machines
            </h1>
            <p className="text-xs text-white/25 mt-0.5">
              {containers.length} / {maxContainers} containers active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchContainers}
              className="p-2 rounded-lg border border-white/5 hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"
              title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button onClick={createContainer}
              disabled={creating || containers.length >= maxContainers}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10 transition-all">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Spawn Machine
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-6 mt-4 max-w-5xl lg:mx-auto">
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/15 text-red-400 text-xs">
              <AlertCircle size={14} />
              {error}
              <button onClick={() => setError("")} className="ml-auto text-red-400/50 hover:text-red-400">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Container Grid */}
      <div className="p-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-purple-400 animate-spin" />
          </div>
        ) : containers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#1a1b26] border border-white/5 flex items-center justify-center">
              <Server size={36} className="text-white/10" />
            </div>
            <h3 className="text-base font-bold text-white/40 mb-2">No machines running</h3>
            <p className="text-sm text-white/15 mb-6">Spawn a machine to get started with your own Linux environment.</p>
            <button onClick={createContainer} disabled={creating}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-semibold flex items-center gap-2 mx-auto shadow-lg shadow-purple-500/15 transition-all disabled:opacity-50">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Spawn Machine
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {containers.map(ct => {
              const isRunning = ct.status === "running";
              const isStopped = ct.status === "stopped";
              const isActing = !!actionLoading[ct.vmid];
              const currentAction = actionLoading[ct.vmid];

              return (
                <motion.div key={ct.vmid}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/5 bg-[#1a1b26] overflow-hidden hover:border-purple-500/15 transition-all group"
                >
                  {/* Status bar */}
                  <div className={`h-1 ${isRunning ? 'bg-[#9ece6a]' : isStopped ? 'bg-[#f7768e]' : 'bg-[#e0af68]'}`} />

                  {/* Machine info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isRunning 
                            ? 'bg-[#9ece6a]/10 border border-[#9ece6a]/20' 
                            : 'bg-white/5 border border-white/5'
                        }`}>
                          <Cpu size={18} className={isRunning ? 'text-[#9ece6a]' : 'text-white/20'} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">CT {ct.vmid}</div>
                          <div className="text-[10px] text-white/20 font-mono">draco-agent</div>
                        </div>
                      </div>
                      <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isRunning 
                          ? 'bg-[#9ece6a]/10 text-[#9ece6a] border border-[#9ece6a]/15' 
                          : isStopped 
                          ? 'bg-[#f7768e]/10 text-[#f7768e] border border-[#f7768e]/15' 
                          : 'bg-[#e0af68]/10 text-[#e0af68] border border-[#e0af68]/15'
                      }`}>
                        {ct.status}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
                      <div className="flex items-center gap-1.5 text-white/25">
                        <Wifi size={11} />
                        <span className="font-mono">{ct.containerIP || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/25">
                        <Clock size={11} />
                        <span>{getUptime(ct.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/25">
                        <HardDrive size={11} />
                        <span>4GB disk</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/25">
                        <Cpu size={11} />
                        <span>1 core / 512MB</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      {isRunning && (
                        <>
                          <button onClick={() => onOpenTerminal(ct.vmid, ct.sessionId)}
                            className="flex-1 py-2 rounded-lg bg-[#9ece6a]/10 hover:bg-[#9ece6a]/20 text-[#9ece6a] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-[#9ece6a]/10">
                            <Terminal size={13} />
                            Terminal
                          </button>
                          <button onClick={() => containerAction(ct.vmid, "stop")} disabled={isActing}
                            className="p-2 rounded-lg border border-white/5 hover:bg-white/5 text-white/25 hover:text-[#e0af68] transition-all disabled:opacity-30" title="Stop">
                            {currentAction === "stop" ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                          </button>
                          <button onClick={() => containerAction(ct.vmid, "reboot")} disabled={isActing}
                            className="p-2 rounded-lg border border-white/5 hover:bg-white/5 text-white/25 hover:text-[#7aa2f7] transition-all disabled:opacity-30" title="Reboot">
                            {currentAction === "reboot" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          </button>
                        </>
                      )}
                      {isStopped && (
                        <>
                          <button onClick={() => containerAction(ct.vmid, "start")} disabled={isActing}
                            className="flex-1 py-2 rounded-lg bg-[#9ece6a]/10 hover:bg-[#9ece6a]/20 text-[#9ece6a] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-[#9ece6a]/10 disabled:opacity-30">
                            {currentAction === "start" ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                            Start
                          </button>
                        </>
                      )}
                      <button onClick={() => destroyContainer(ct.vmid, ct.sessionId)} disabled={isActing}
                        className="p-2 rounded-lg border border-white/5 hover:bg-red-500/10 text-white/15 hover:text-[#f7768e] transition-all disabled:opacity-30" title="Destroy">
                        {currentAction === "destroy" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Add slot */}
            {containers.length < maxContainers && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={createContainer}
                disabled={creating}
                className="rounded-xl border border-dashed border-white/5 hover:border-purple-500/20 bg-transparent hover:bg-purple-500/[0.02] flex flex-col items-center justify-center py-12 transition-all group disabled:opacity-30"
              >
                {creating ? (
                  <Loader2 size={24} className="text-purple-400 animate-spin mb-2" />
                ) : (
                  <Plus size={24} className="text-white/10 group-hover:text-purple-400/40 mb-2 transition-colors" />
                )}
                <span className="text-xs text-white/15 group-hover:text-white/30 transition-colors">
                  {creating ? "Spawning..." : "Spawn machine"}
                </span>
              </motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
