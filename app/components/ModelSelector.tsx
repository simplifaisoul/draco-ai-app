import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface Model {
    id: string;
    name: string;
    icon: string;
    description: string;
}

interface ModelSelectorProps {
    models: Model[];
    selectedModelId: string;
    onSelect: (id: string) => void;
}

export const ModelSelector = ({ models, selectedModelId, onSelect }: ModelSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

    const [isHealthy, setIsHealthy] = useState(true);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                setIsHealthy(data.status !== 'down');
            } catch (e) {
                setIsHealthy(false);
            }
        };
        checkHealth();
        // Poll every 30s
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative z-50" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-[#1f242d] border border-[#2d3748] hover:border-indigo-500/50 hover:bg-[#2d3748] text-white px-3 py-2 rounded-lg text-sm transition-all shadow-lg active:scale-95 w-48 justify-between"
            >
                <span className="flex items-center gap-2 truncate">
                    <span className="text-lg">{selectedModel.icon}</span>
                    <span className="font-medium truncate">{selectedModel.name}</span>
                </span>

                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`} title={isHealthy ? "System Online" : "System Issues"}></div>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-72 bg-[#161b22] border border-[#2d3748] rounded-xl shadow-2xl overflow-hidden flex flex-col p-1"
                    >
                        {models.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => {
                                    onSelect(model.id);
                                    setIsOpen(false);
                                }}
                                className={`flex items-start gap-3 p-3 rounded-lg transition-colors text-left group ${selectedModelId === model.id ? "bg-indigo-600/10" : "hover:bg-[#1f242d]"
                                    }`}
                            >
                                <span className="text-xl mt-0.5">{model.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium flex items-center justify-between ${selectedModelId === model.id ? "text-indigo-400" : "text-gray-200"
                                        }`}>
                                        {model.name}
                                        {selectedModelId === model.id ? <Check size={14} className="text-indigo-400" /> : <span className="w-2 h-2 rounded-full bg-green-500/50"></span>}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate group-hover:text-gray-400">
                                        {model.description}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};
