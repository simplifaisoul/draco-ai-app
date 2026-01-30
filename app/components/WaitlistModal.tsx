"use client";

import React, { useState } from 'react';

interface WaitlistModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WaitlistModal: React.FC<WaitlistModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    // Reset state when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            setStatus("idle");
            setEmail("");
            setMessage("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");

        // EmailJS Configuration
        const SERVICE_ID = "service_gdbvzu8";
        const TEMPLATE_ID = "template_0hjybot";
        const PUBLIC_KEY = "Gcg7webvGA3nyOv2o";

        const payload = {
            service_id: SERVICE_ID,
            template_id: TEMPLATE_ID,
            user_id: PUBLIC_KEY,
            template_params: {
                to_email: email, // Standard param, usually matches template
                user_email: email,
                message: "Requesting Beta Access"
            }
        };

        try {
            const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responseData = await response.text();
            console.log("EmailJS Response:", response.status, responseData);

            if (response.ok) {
                setStatus("success");
                setMessage("You have been added to the queue.");
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                console.error("EmailJS Error:", responseData);
                throw new Error(`EmailJS failed: ${responseData}`);
            }
        } catch (error) {
            console.error("Waitlist Error:", error);
            setStatus("error");
            setMessage("Email service unavailable. Please contact soulsimplifai@gmail.com directly.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-black/40 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-8 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                {/* Decorative Glow */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="mb-4 p-3 bg-white/5 rounded-full border border-white/10">
                        <span className="text-2xl">🔒</span>
                    </div>

                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 mb-2">
                        Details Classified
                    </h2>

                    <p className="text-sm text-[var(--foreground)]/60 mb-6 leading-relaxed">
                        Draco Agent Mode (Beta) provides autonomous execution capabilities.
                        Access is currently restricted to maintain system stability.
                    </p>

                    {status === "success" ? (
                        <div className="w-full py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm font-medium">
                            {message}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="w-full space-y-4">
                            <div className="relative group">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all text-white placeholder-white/30"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className={`w-full py-3.5 rounded-xl font-medium transition-all duration-300 relative overflow-hidden group
                  ${status === "loading"
                                        ? "bg-white/5 text-white/50 cursor-not-allowed"
                                        : "bg-white text-black hover:bg-[var(--color-primary)] hover:text-white border border-transparent hover:border-white/20 hover:shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                                    }
                `}
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                {status === "loading" ? "Processing Protocol..." : "Request Access"}
                            </button>
                        </form>
                    )}

                    {status === "error" && (
                        <p className="mt-3 text-xs text-red-400">{message}</p>
                    )}

                    <p className="mt-6 text-[10px] text-white/20 uppercase tracking-widest">
                        Limited Availability • V0.4
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WaitlistModal;
