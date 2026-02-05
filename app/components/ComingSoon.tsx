"use client";

import React, { useState } from 'react';
import LightningBackground from './LightningBackground';

const ComingSoon: React.FC = () => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus("loading");

        // EmailJS Configuration (same as WaitlistModal)
        const SERVICE_ID = "service_gdbvzu8";
        const TEMPLATE_ID = "template_0hjybot";
        const PUBLIC_KEY = "Gcg7webvGA3nyOv2o";

        const payload = {
            service_id: SERVICE_ID,
            template_id: TEMPLATE_ID,
            user_id: PUBLIC_KEY,
            template_params: {
                to_email: email,
                user_email: email,
                message: "Requesting Draco Waitlist Access"
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

            if (response.ok) {
                setStatus("success");
                setMessage("You're on the list! We'll notify you when Draco launches.");
                setTimeout(() => {
                    setEmail("");
                    setStatus("idle");
                    setMessage("");
                }, 3000);
            } else {
                throw new Error(`EmailJS failed`);
            }
        } catch (error) {
            console.error("Waitlist Error:", error);
            setStatus("error");
            setMessage("Email service unavailable. Please contact soulsimplifai@gmail.com directly.");
        }
    };

    return (
        <div className="relative w-full min-h-screen bg-black text-white overflow-hidden">
            {/* Background Gradient */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/30 via-black to-black opacity-80"></div>

            {/* Lightning Effect */}
            <div className="fixed inset-0 z-0 pointer-events-none mix-blend-screen">
                <LightningBackground hue={270} intensity={1.8} size={1.2} speed={0.8} />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 py-20">
                {/* Logo/Brand */}
                <div className="mb-8 relative">
                    <img
                        src="/dragon_final.png"
                        alt="Draco Logo"
                        className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.6)] animate-pulse"
                    />
                </div>

                {/* Main Heading */}
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none mb-6">
                    <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">DRACO</span>
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-300 to-white drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]">
                        IS COMING
                    </span>
                </h1>

                {/* Subheading */}
                <p className="text-xl md:text-2xl text-gray-300 max-w-2xl font-medium mb-12">
                    Join the waitlist for <span className="text-purple-400 font-bold">Draco V0.4</span>
                    <br />
                    The next generation AI assistant by SimplifAI-1
                </p>

                {/* Waitlist Form */}
                {status === "success" ? (
                    <div className="w-full max-w-md py-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-200 text-sm font-medium backdrop-blur-sm">
                        {message}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
                        <div className="relative group">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className="w-full bg-black/40 border border-white/20 rounded-xl px-6 py-4 outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/50 transition-all text-white placeholder-white/40 backdrop-blur-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={status === "loading"}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 relative overflow-hidden group
                                ${status === "loading"
                                    ? "bg-white/5 text-white/50 cursor-not-allowed"
                                    : "bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-500 hover:to-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                                }
                            `}
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {status === "loading" ? "Joining..." : "Join the Waitlist"}
                        </button>
                    </form>
                )}

                {status === "error" && (
                    <p className="mt-4 text-sm text-red-400 max-w-md">{message}</p>
                )}

                {/* Footer Info */}
                <p className="mt-12 text-xs text-white/30 uppercase tracking-widest">
                    Under Construction • Coming Soon
                </p>
            </div>
        </div>
    );
};

export default ComingSoon;
