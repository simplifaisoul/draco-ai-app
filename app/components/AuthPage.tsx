"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import LightningBackground from "./LightningBackground";

interface AuthPageProps {
    onBack?: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onBack }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError } = useAuth();
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        clearError();

        try {
            if (mode === "signin") {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password, displayName || undefined);
            }
        } catch {
            // Error is handled by AuthContext
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        clearError();
        try {
            await signInWithGoogle();
        } catch {
            // Error is handled by AuthContext
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
        clearError();
        setEmail("");
        setPassword("");
        setDisplayName("");
    };

    return (
        <div className="relative w-full min-h-screen bg-black text-white overflow-hidden">
            {/* Background Gradient */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/30 via-black to-black opacity-80" />

            {/* Lightning Effect */}
            <div className="fixed inset-0 z-0 pointer-events-none mix-blend-screen">
                <LightningBackground hue={270} intensity={1.2} size={1.0} speed={0.6} />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
                {/* Back Button (only shown if onBack provided) */}
                {onBack && (
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        onClick={onBack}
                        className="absolute top-6 left-6 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back
                    </motion.button>
                )}

                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6"
                >
                    <img
                        src="/dragon_final.png"
                        alt="Draco Logo"
                        className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]"
                    />
                </motion.div>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-md"
                >
                    <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-[0_0_60px_rgba(168,85,247,0.08)]">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                                {mode === "signin" ? "Welcome Back" : "Join Draco"}
                            </h1>
                            <p className="text-white/40 text-sm mt-2">
                                {mode === "signin"
                                    ? "Sign in to access your AI assistant"
                                    : "Create an account to get started"}
                            </p>
                        </div>

                        {/* Google Sign-In */}
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] hover:border-white/[0.20] rounded-xl py-3.5 px-4 text-white font-medium transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {/* Google Icon */}
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Continue with Google
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-white/[0.08]" />
                            <span className="text-white/25 text-xs uppercase tracking-widest font-medium">or</span>
                            <div className="flex-1 h-px bg-white/[0.08]" />
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Display Name (signup only) */}
                            <AnimatePresence mode="wait">
                                {mode === "signup" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div className="relative">
                                            <User
                                                size={16}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                                            />
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                placeholder="Display name (optional)"
                                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3.5 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-white placeholder-white/25 text-sm"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Email */}
                            <div className="relative">
                                <Mail
                                    size={16}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                                />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email address"
                                    required
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3.5 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-white placeholder-white/25 text-sm"
                                />
                            </div>

                            {/* Password */}
                            <div className="relative">
                                <Lock
                                    size={16}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                                />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={mode === "signup" ? "Create password (6+ chars)" : "Password"}
                                    required
                                    minLength={6}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-11 pr-12 py-3.5 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all text-white placeholder-white/25 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Error Display */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 size={18} className="animate-spin" />
                                        {mode === "signin" ? "Signing in..." : "Creating account..."}
                                    </span>
                                ) : (
                                    <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
                                )}
                            </button>
                        </form>

                        {/* Toggle Mode */}
                        <div className="mt-6 text-center">
                            <p className="text-white/30 text-sm">
                                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                                <button
                                    onClick={toggleMode}
                                    className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                                >
                                    {mode === "signin" ? "Sign Up" : "Sign In"}
                                </button>
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center mt-6 text-[10px] text-white/20 uppercase tracking-widest">
                        Powered by SimplifAI-1
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default AuthPage;
