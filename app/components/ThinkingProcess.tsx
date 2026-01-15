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
        <div className="mb-4 max-w-[90%] md:max-w-[75%]">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-indigo-400 transition-colors mb-2 bg-[#1f242d]/50 px-3 py-1.5 rounded-full border border-[#2d3748] hover:border-indigo-500/50"
            >
                <Brain size={14} className={isThinking ? "animate-pulse text-indigo-400" : ""} />
                <span>{isThinking ? "Thinking..." : "Thought Process"}</span>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#1f242d]/30 border-l-2 border-indigo-500/30 pl-4 py-2 rounded-r-lg text-xs md:text-sm text-gray-400 font-mono overflow-auto max-h-60 custom-scrollbar"
                    >
                        {/* Render raw strings naturally, preserving whitespace for code-like thoughts */}
                        <div className="whitespace-pre-wrap leading-relaxed opacity-80">
                            {thought || <span className="animate-pulse">Analyzing...</span>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
