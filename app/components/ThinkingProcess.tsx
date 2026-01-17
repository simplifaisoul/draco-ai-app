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
                className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-indigo-400 transition-colors mb-2 bg-[#1f242d]/50 px-3 py-1.5 rounded-full border border-[#2d3748] hover:border-indigo-500/50 group"
            >
                <div className={`relative ${isThinking ? "animate-pulse" : ""}`}>
                    <Brain size={14} className={`text-indigo-400 ${isThinking ? "animate-spin-slow" : ""}`} />
                    {isThinking && <div className="absolute inset-0 bg-indigo-500 blur-sm opacity-50 rounded-full"></div>}
                </div>
                <span className="group-hover:text-indigo-300 transition-colors">{isThinking ? "Reasoning Engine Active..." : "Chain of Thought"}</span>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#161b22] border-l-2 border-indigo-500/50 pl-4 py-3 pr-2 rounded-r-lg text-xs md:text-sm text-gray-400 font-mono overflow-auto max-h-60 custom-scrollbar shadow-inner"
                    >
                        <div className="whitespace-pre-wrap leading-relaxed opacity-90">
                            {thought || <span className="animate-pulse text-indigo-400/70">Analyzing logic pathways...</span>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
