"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/AuthContext";
import { getRemainingRequests } from "../lib/usage";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  trigger?: string;
}

export default function PricingModal({
  isOpen,
  onClose,
  currentPlan,
  trigger,
}: PricingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const remaining = getRemainingRequests(currentPlan);

  const handleUpgrade = async (planId: string) => {
    if (planId === "free" || planId === currentPlan) return;
    if (!user) return;

    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          userId: user.uid,
          userEmail: user.email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.email) return;
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: user.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setLoading(null);
    }
  };

  // Contextual headline based on trigger
  const getHeadline = () => {
    if (trigger === "messages") return "You've hit your daily limit";
    if (trigger === "images") return "Image limit reached";
    return "Go Unlimited with Pro";
  };

  const getSubheadline = () => {
    if (trigger === "messages")
      return `You've used all 33 free requests today. Upgrade to keep the conversation going — no interruptions, ever.`;
    if (trigger === "images")
      return "Free accounts can generate 3 images per day. Go Pro for unlimited creative freedom.";
    return "Stop counting requests. Pro members get unlimited everything — the AI works as fast as you think.";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={onClose}
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[520px] mx-4 max-h-[92vh] overflow-y-auto"
          >
            {/* Ambient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/25 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-[#13111C] to-[#0a090f] shadow-2xl overflow-hidden">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-all duration-300 hover:rotate-90"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {/* Header */}
              <div className="text-center pt-10 pb-2 px-8">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  {trigger && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-medium mb-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      {trigger === "messages" ? `${remaining}/33 requests left` : "Daily limit reached"}
                    </div>
                  )}
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                    {getHeadline()}
                  </h2>
                  <p className="mt-3 text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
                    {getSubheadline()}
                  </p>
                </motion.div>
              </div>

              {/* Pro Card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mx-6 mt-6 mb-4 rounded-2xl p-[1px] bg-gradient-to-b from-purple-500/40 via-pink-500/20 to-purple-600/40"
              >
                <div className="rounded-2xl bg-[#0e0d14] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-xl">⚡</span> Draco Pro
                      </h3>
                      <p className="text-white/30 text-xs mt-0.5">Everything. No limits.</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">$12</div>
                      <div className="text-white/25 text-[10px]">per month</div>
                    </div>
                  </div>

                  {/* Features grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-6">
                    {[
                      ["∞", "Unlimited AI requests"],
                      ["∞", "Unlimited image gen"],
                      ["⚡", "Priority speed"],
                      ["🎨", "All premium themes"],
                      ["🧠", "Advanced reasoning"],
                      ["💾", "Memory Vault"],
                      ["📎", "File uploads"],
                      ["🛡️", "Priority support"],
                    ].map(([icon, label], i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                        <span className="w-5 text-center text-[11px]">{icon}</span>
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => currentPlan === "pro" ? handleManageBilling() : handleUpgrade("pro")}
                    disabled={loading === "pro" || loading === "portal"}
                    className="group relative w-full py-3.5 px-4 rounded-xl text-sm font-bold overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 group-hover:from-purple-500 group-hover:to-pink-500" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </div>
                    <span className="relative text-white flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Redirecting...
                        </>
                      ) : currentPlan === "pro" ? (
                        "Manage Subscription"
                      ) : (
                        <>
                          Upgrade Now — $12/mo
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </motion.div>

              {/* Social proof + trust */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="px-8 pb-8 space-y-3"
              >
                {/* Comparison callout */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">💡</span>
                  </div>
                  <p className="text-[11px] text-white/35 leading-relaxed">
                    <span className="text-white/60 font-medium">Less than $0.40/day</span> — cheaper than a coffee, unlimited AI power all day.
                  </p>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-5 pt-2">
                  <div className="flex items-center gap-1.5 text-white/20 text-[10px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    Stripe secured
                  </div>
                  <div className="w-px h-3 bg-white/10" />
                  <div className="text-white/20 text-[10px]">Cancel anytime</div>
                  <div className="w-px h-3 bg-white/10" />
                  <div className="text-white/20 text-[10px]">Instant activation</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
