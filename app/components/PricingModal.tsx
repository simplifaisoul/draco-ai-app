"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/AuthContext";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  trigger?: string; // "messages" | "images" | "manual"
}

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "",
    badge: "Current",
    features: [
      "25 messages per day",
      "3 AI images per day",
      "Cosmic theme",
      "Basic models",
    ],
    cta: "Current Plan",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 12,
    period: "/mo",
    badge: "Most Popular",
    features: [
      "Unlimited messages",
      "50 AI images per day",
      "All 3 themes",
      "Priority speed",
      "Chain of Thought",
      "Memory Vault",
      "File uploads",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    id: "team",
    name: "Team",
    price: 25,
    period: "/user/mo",
    badge: "Best Value",
    features: [
      "Everything in Pro",
      "200 AI images per day",
      "Shared workspaces",
      "Team memory",
      "Custom system prompts",
      "Priority support",
    ],
    cta: "Upgrade to Team",
    popular: false,
  },
];

export default function PricingModal({
  isOpen,
  onClose,
  currentPlan,
  trigger,
}: PricingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

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
      } else {
        alert("Failed to create checkout session. Please try again.");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Something went wrong. Please try again.");
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
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setLoading("portal");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--sidebar-bg)] border border-[var(--border-color)] shadow-2xl shadow-purple-500/10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center pt-8 pb-4 px-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
                Upgrade Draco AI
              </h2>
              {trigger === "messages" && (
                <p className="mt-2 text-white/50 text-sm">
                  You&apos;ve hit your daily message limit. Upgrade for unlimited
                  access.
                </p>
              )}
              {trigger === "images" && (
                <p className="mt-2 text-white/50 text-sm">
                  You&apos;ve used all your daily image generations. Upgrade for
                  more.
                </p>
              )}
              {!trigger && (
                <p className="mt-2 text-white/50 text-sm">
                  Unlock the full power of Draco AI
                </p>
              )}
            </div>

            {/* Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const isUpgrade = plan.id !== "free" && plan.id !== currentPlan;

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 ${
                      plan.popular
                        ? "border-purple-500/50 bg-purple-500/5 shadow-lg shadow-purple-500/10 scale-[1.02]"
                        : "border-[var(--border-color)] bg-white/[0.02]"
                    } ${isCurrent ? "ring-2 ring-purple-500/30" : ""}`}
                  >
                    {/* Badge */}
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                        {plan.badge}
                      </div>
                    )}

                    {isCurrent && !plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 text-white/60 text-xs font-bold rounded-full border border-white/20">
                        Current
                      </div>
                    )}

                    {/* Price */}
                    <div className="text-center mb-4 mt-2">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-[var(--foreground)]">
                          {plan.price === 0 ? "Free" : `$${plan.price}`}
                        </span>
                        {plan.period && (
                          <span className="text-white/40 text-sm">
                            {plan.period}
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-sm mt-1">{plan.name}</p>
                    </div>

                    {/* Features */}
                    <ul className="flex-1 space-y-2 mb-6">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-sm text-white/70"
                        >
                          <span className="text-green-400 mt-0.5 shrink-0">
                            ✓
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() =>
                        isCurrent && currentPlan !== "free"
                          ? handleManageBilling()
                          : handleUpgrade(plan.id)
                      }
                      disabled={
                        (isCurrent && currentPlan === "free") ||
                        loading === plan.id
                      }
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                        isUpgrade
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02]"
                          : isCurrent && currentPlan !== "free"
                          ? "bg-white/10 hover:bg-white/15 text-white/80 border border-white/10"
                          : "bg-white/5 text-white/30 cursor-not-allowed"
                      }`}
                    >
                      {loading === plan.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Redirecting...
                        </span>
                      ) : isCurrent && currentPlan !== "free" ? (
                        "Manage Billing"
                      ) : isCurrent ? (
                        plan.cta
                      ) : (
                        plan.cta
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="text-center pb-6 px-6">
              <p className="text-white/30 text-xs">
                Secure payments by Stripe • Cancel anytime • No hidden fees
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
