import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { X, Cloud, Clock, Activity, MessageSquare, Brain } from "lucide-react";

interface DashboardProps {
    isOpen: boolean;
    onClose: () => void;
    stats: {
        messageCount: number;
        memoryCount: number;
    };
    onVibeSelect: (prompt: string) => void;
    onOpenSettings: () => void;
}

const VIBES = [
    { id: 'default', name: 'Draco Default', desc: 'Helpful & Smart', emoji: '🐉', prompt: 'You are Draco AI. Helpful, smart, and concise. Format code nicely.' },
    { id: 'coder', name: 'Code Wizard', desc: 'Tech Expert', emoji: '👨‍💻', prompt: 'You are an expert Senior Software Engineer. You write clean, secure, and optimized code. You assume the user is also a developer.' },
    { id: 'roast', name: 'Roast Master', desc: 'Savage & Funny', emoji: '🔥', prompt: 'You are a savage Roast Master. You are helpful but you ruthlessly roast the user\'s questions and code.' },
    { id: 'uwu', name: 'UwU Bot', desc: 'Cursed Energy', emoji: '👉👈', prompt: 'You are a shy anime girl. You use emoticons like uwu and owo constantly. You are very helpful but cringe.' },
];

export const Dashboard = ({ isOpen, onClose, stats, onVibeSelect, onOpenSettings }: DashboardProps) => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState<string>("Loading...");
    const [greeting, setGreeting] = useState("");

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const hours = time.getHours();
        if (hours < 12) setGreeting("Good morning");
        else if (hours < 18) setGreeting("Good afternoon");
        else setGreeting("Good evening");
    }, [time]);

    useEffect(() => {
        if (isOpen) {
            fetch("https://wttr.in/?format=3")
                .then(res => res.text())
                .then(data => setWeather(data.trim()))
                .catch(() => setWeather("Weather unavailable"));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
        >
            <button
                onClick={onClose}
                className="absolute top-6 right-6 text-gray-400 hover:text-white bg-white/5 p-2 rounded-full transition-all"
            >
                <X size={24} />
            </button>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Clock & Greeting Module */}
                <div className="md:col-span-2 lg:col-span-2 bg-[#1f242d]/80 border border-[#2d3748] rounded-3xl p-8 flex flex-col justify-between h-64 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/20 transition-all duration-700"></div>

                    <div>
                        <h2 className="text-3xl font-light text-gray-300">{greeting}, User.</h2>
                        <div className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                            <Cloud size={14} /> {weather}
                        </div>
                    </div>

                    <div className="text-8xl font-bold tracking-tighter bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent font-mono">
                        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                {/* Stats Module */}
                <div className="bg-[#1f242d]/80 border border-[#2d3748] rounded-3xl p-6 flex flex-col justify-center gap-6 relative overflow-hidden h-64">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{stats.messageCount}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Messages sent</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                            <Brain size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{stats.memoryCount}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Memories stored</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
                            <Activity size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">Online</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">System Status</div>
                        </div>
                    </div>
                </div>

                {/* Vibe Check / Personality Engine */}
                <div className="md:col-span-3 bg-[#1f242d]/80 border border-[#2d3748] rounded-3xl p-6 flex flex-col gap-4">
                    <h3 className="text-gray-400 text-sm uppercase tracking-wider font-bold">Vibe Check (Personality)</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {VIBES.map(vibe => (
                            <button
                                key={vibe.id}
                                onClick={() => { onVibeSelect(vibe.prompt); onClose(); }} // Close dashboard on select for instant feel
                                className="bg-[#1f242d] border border-[#2d3748] hover:border-indigo-500 hover:bg-indigo-500/10 p-4 rounded-xl text-left transition-all active:scale-95 group"
                            >
                                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">{vibe.emoji}</div>
                                <div className="font-bold text-gray-200">{vibe.name}</div>
                                <div className="text-xs text-gray-500">{vibe.desc}</div>
                            </button>
                        ))}


                        {/* Custom Button */}
                        <button
                            onClick={() => { onOpenSettings(); onClose(); }}
                            className="bg-[#1f242d]/50 border border-dashed border-[#2d3748] hover:border-indigo-500 hover:text-indigo-400 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                        >
                            <div className="text-2xl group-hover:scale-110 transition-transform">✨</div>
                            <div className="font-bold text-sm">Create Custom</div>
                        </button>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};
