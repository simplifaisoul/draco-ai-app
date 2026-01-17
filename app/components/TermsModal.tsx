"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertTriangle, Check } from "lucide-react";

export function TermsModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const accepted = localStorage.getItem("draco_tos_accepted");
        if (!accepted) {
            setIsOpen(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("draco_tos_accepted", "true");
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative bg-[#1f242d] border border-indigo-500/30 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl overflow-hidden"
                    >
                        {/* Background Glow */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

                        <div className="flex items-center gap-3 mb-6 text-indigo-400">
                            <Shield size={32} />
                            <h2 className="text-2xl font-bold text-white">Welcome to Draco V1.0 Open Beta</h2>
                        </div>

                        <div className="space-y-4 text-gray-300 text-sm leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-2 text-yellow-200">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <p>This is Beta software. Features may be unstable. Do not rely on this for critical tasks.</p>
                            </div>

                            <h3 className="font-semibold text-white">1. Acceptance of Terms</h3>
                            <p>By using Draco AI ("the Service"), you agree to these terms. If you do not agree, please do not use the Service.</p>

                            <h3 className="font-semibold text-white">2. Acceptable Use Policy</h3>
                            <p>You agree NOT to use the Service to generate:</p>
                            <ul className="list-disc pl-5 space-y-1 text-gray-400">
                                <li>Illegal, harmful, or dangerous content.</li>
                                <li>Hate speech, harassment, or explicit violence.</li>
                                <li>Sexually explicit material (NSFW).</li>
                            </ul>

                            <h3 className="font-semibold text-white">3. No Warranty</h3>
                            <p>The Service is provided "AS IS". We make no warranties regarding uptime, accuracy, or reliability.</p>

                            <h3 className="font-semibold text-white">4. Data Storage</h3>
                            <p>Your chat history is stored locally on your device. We do not store your conversations on our servers.</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[#2d3748]">
                            {/* No Decline button, just Accept to proceed or close tab */}
                            <button
                                onClick={handleAccept}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all active:scale-95 shadow-lg shadow-indigo-500/20 w-full justify-center md:w-auto"
                            >
                                <Check size={18} />
                                I Accept & Continue
                            </button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
