import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import { useState } from "react";

interface ThinkingProcessProps {
    thought: string;
    isThinking: boolean;
}

export const ThinkingProcess = ({ thought, isThinking }: ThinkingProcessProps) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!thought && !isThinking) return null;

    return (
        <div className="mb-4 w-full">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors mb-2 bg-[var(--background)]/30 px-3 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--color-primary)]/50 group"
            >
                <div className={`relative ${isThinking ? "animate-pulse" : ""}`}>
                    <Brain size={14} className={`text-[var(--color-primary)] ${isThinking ? "animate-spin-slow" : ""}`} />
                    {isThinking && <div className="absolute inset-0 bg-[var(--color-primary)] blur-sm opacity-50 rounded-full"></div>}
                </div>
                <span className="group-hover:text-[var(--color-primary)] transition-colors">{isThinking ? "Reasoning Engine Active..." : "Chain of Thought"}</span>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[var(--sidebar-bg)]/50 border-l-2 border-[var(--color-primary)]/50 pl-4 py-3 pr-2 rounded-r-lg text-xs md:text-sm text-[var(--color-secondary)] font-mono overflow-auto max-h-60 custom-scrollbar shadow-inner"
                    >
                        <div className="whitespace-pre-wrap leading-relaxed opacity-90">
                            {thought || <span className="animate-pulse text-[var(--color-primary)]/70">Analyzing logic pathways...</span>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
