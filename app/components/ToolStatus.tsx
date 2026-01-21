import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolStatusProps {
    content: string;
}

export const ToolStatus = ({ content }: ToolStatusProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // Parse content to remove the wrapper text if possible
    const cleanContent = content.replace("🛠️ **Tool Output:**", "").replace(/```/g, "").trim();
    const summary = cleanContent.split('\n')[0].substring(0, 60) + (cleanContent.length > 60 ? "..." : "");

    return (
        <div className="w-full max-w-2xl mx-auto my-2">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-lg cursor-pointer transition-all group"
            >
                <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    <Terminal size={14} />
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                        <span>System Action Executed</span>
                        <CheckCircle2 size={12} />
                    </div>
                    <div className="text-[10px] text-emerald-500/60 font-mono mt-0.5 truncate">
                        {summary}
                    </div>
                </div>

                <button className="text-emerald-500/50 group-hover:text-emerald-400 transition-colors">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1 p-3 bg-black/40 rounded-lg border border-emerald-500/10 text-xs font-mono text-emerald-200/80 whitespace-pre-wrap break-all custom-scrollbar max-h-60 overflow-y-auto">
                            {cleanContent}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
