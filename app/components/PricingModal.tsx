"use client";

import React, { useState, useEffect } from "react";
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
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
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
            initial={{ opacity: 0, scale: 0.88, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl mx-4 max-h-[92vh] overflow-y-auto"
          >
            {/* Glow effects */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-pink-600/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-all duration-300 hover:rotate-90"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {/* Header */}
              <div className="text-center pt-12 pb-2 px-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    {trigger === "messages"
                      ? `Only ${remaining} requests left today`
                      : trigger === "images"
                        ? "You've hit your image limit"
                        : "For less than $0.40/day"}
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                      Go Unlimited
                    </span>
                  </h2>
                  <p className="mt-3 text-white/40 text-base max-w-md mx-auto">
                    Stop counting requests. Upgrade once and use Draco without limits — forever.
                  </p>
                </motion.div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 pt-6 max-w-3xl mx-auto">

                {/* FREE PLAN */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  onMouseEnter={() => setHoveredPlan("free")}
                  onMouseLeave={() => setHoveredPlan(null)}
                  className={`relative rounded-2xl border p-7 flex flex-col transition-all duration-500 ${currentPlan === "free"
                    ? "border-white/20 bg-white/[0.03]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/15"
                    }`}
                >
                  {currentPlan === "free" && (
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-white/10 text-white/60 text-[10px] font-bold rounded-full border border-white/20 uppercase tracking-widest">
                      Current
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                      <span className="text-lg">🐲</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Free</h3>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-bold text-white">$0</span>
                      <span className="text-white/30 text-sm">/forever</span>
                    </div>
                  </div>

                  <ul className="flex-1 space-y-3 mb-7">
                    {[
                      "33 requests per day",
                      "3 images per day",
                      "1 theme",
                      "Standard speed",
                      "Basic chat history",
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-white/50">
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-white/5 text-white/25 cursor-not-allowed border border-white/5"
                  >
                    Current Plan
                  </button>
                </motion.div>

                {/* PRO PLAN */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onMouseEnter={() => setHoveredPlan("pro")}
                  onMouseLeave={() => setHoveredPlan(null)}
                  className="relative rounded-2xl p-[1px] bg-gradient-to-b from-purple-500/50 via-pink-500/30 to-purple-600/50 transition-all duration-500 hover:from-purple-500/70 hover:via-pink-500/50 hover:to-purple-600/70"
                >
                  {/* Glow behind card */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-purple-600/20 to-pink-600/10 blur-xl -z-10" />

                  <div className="relative rounded-2xl bg-gradient-to-b from-gray-900/98 to-[#0a0a0f] p-7 flex flex-col h-full">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg shadow-purple-500/30">
                      ✦ Recommended
                    </div>

                    <div className="mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
                        <span className="text-lg">⚡</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">Pro</h3>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">$12</span>
                        <span className="text-white/30 text-sm">/month</span>
                      </div>
                      <p className="text-white/30 text-xs mt-1">Cancel anytime</p>
                    </div>

                    <ul className="flex-1 space-y-3 mb-7">
                      {[
                        ["Unlimited requests — no daily cap", true],
                        ["Unlimited image generation", true],
                        ["All 3 premium themes", false],
                        ["Faster response speed", true],
                        ["Chain of Thought reasoning", false],
                        ["Memory Vault", false],
                        ["File uploads & analysis", false],
                        ["Priority support", false],
                      ].map(([f, highlight], i) => (
                        <li key={i} className={`flex items-start gap-3 text-sm ${highlight ? "text-white/90 font-medium" : "text-white/50"}`}>
                          <svg className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-purple-400" : "text-purple-400/50"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() =>
                        currentPlan === "pro"
                          ? handleManageBilling()
                          : handleUpgrade("pro")
                      }
                      disabled={loading === "pro"}
                      className="group relative w-full py-4 px-4 rounded-xl text-sm font-bold overflow-hidden"
                    >
                      {/* Button gradient bg */}
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 group-hover:from-purple-500 group-hover:to-pink-500" />
                      {/* Shine effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      </div>
                      <span className="relative text-white flex items-center justify-center gap-2">
                        {loading === "pro" ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Redirecting to checkout...
                          </>
                        ) : currentPlan === "pro" ? (
                          "Manage Billing"
                        ) : (
                          <>
                            Upgrade to Pro
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="flex items-center justify-center gap-6 pb-8 px-6"
              >
                <div className="flex items-center gap-2 text-white/20 text-xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  Secured by Stripe
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-2 text-white/20 text-xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Cancel anytime
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-2 text-white/20 text-xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  No hidden fees
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
