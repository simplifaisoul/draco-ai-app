import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Plus, MessageSquare, Trash2, ChevronDown, X, Download, Github } from "lucide-react";
import { HistoryManager, ChatSession } from "../lib/history";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeSessionId: string | null;
    onSessionSelect: (id: string) => void;
    onNewChat: () => void;
    onClearAll: () => void;
    onExport: () => void;
    memoryCount: number;
    onToggleMemory: () => void;
    showMemory: boolean;
    memory: string[];
    onForgetMemory: (index: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    activeSessionId,
    onSessionSelect,
    onNewChat,
    onClearAll,
    onExport,
    memoryCount,
    onToggleMemory,
    showMemory,
    memory,
    onForgetMemory
}) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);

    // Refresh sessions when sidebar opens or active ID changes
    useEffect(() => {
        if (typeof window !== "undefined") {
            setSessions(HistoryManager.getSessions());
        }
    }, [isOpen, activeSessionId]);

    const handleDeleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Delete this conversation?")) {
            HistoryManager.deleteSession(id);
            setSessions(HistoryManager.getSessions());
            if (activeSessionId === id) {
                onNewChat();
            }
        }
    };

    const groupSessions = (sessions: ChatSession[]) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups = {
            today: [] as ChatSession[],
            yesterday: [] as ChatSession[],
            older: [] as ChatSession[]
        };

        sessions.forEach(s => {
            const date = new Date(s.updatedAt);
            if (date.toDateString() === today.toDateString()) {
                groups.today.push(s);
            } else if (date.toDateString() === yesterday.toDateString()) {
                groups.yesterday.push(s);
            } else {
                groups.older.push(s);
            }
        });

        return groups;
    };

    const groups = groupSessions(sessions);

    return (
        <>
            <AnimatePresence>
                {(isOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
                    <motion.aside
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`fixed md:relative z-50 w-[280px] h-full bg-[#161b22]/95 backdrop-blur-xl border-r border-[#2d3748] flex flex-col p-4 shadow-2xl md:shadow-none ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent font-mono">
                                <Bot className="text-indigo-500" /> Draco.AI
                            </div>
                            <button onClick={onClose} className="md:hidden text-gray-400 p-2 hover:bg-white/5 rounded-full">
                                <X />
                            </button>
                        </div>

                        {/* Actions */}
                        <button
                            onClick={onNewChat}
                            className="w-full flex items-center gap-2 bg-[#1f242d] hover:bg-[#2d3748] border border-[#2d3748] p-3 rounded-xl text-sm font-medium transition-colors mb-2 active:scale-95 duration-200 shadow-lg shadow-black/20"
                        >
                            <Plus size={18} className="text-indigo-400" /> New Chat
                        </button>

                        {/* History List */}
                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">

                            {groups.today.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 mt-4">Today</div>
                                    {groups.today.map(s => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            isActive={s.id === activeSessionId}
                                            onClick={() => onSessionSelect(s.id)}
                                            onDelete={(e) => handleDeleteSession(e, s.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {groups.yesterday.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 mt-4">Yesterday</div>
                                    {groups.yesterday.map(s => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            isActive={s.id === activeSessionId}
                                            onClick={() => onSessionSelect(s.id)}
                                            onDelete={(e) => handleDeleteSession(e, s.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {groups.older.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 mt-4">Previous 7 Days</div>
                                    {groups.older.map(s => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            isActive={s.id === activeSessionId}
                                            onClick={() => onSessionSelect(s.id)}
                                            onDelete={(e) => handleDeleteSession(e, s.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {sessions.length === 0 && (
                                <div className="p-4 text-xs text-gray-500 text-center italic mt-10">
                                    No conversation history.<br />Start a new chat!
                                </div>
                            )}
                        </div>

                        {/* Footer / Utilities */}
                        <div className="mt-4 border-t border-[#2d3748] pt-4 space-y-2">

                            {/* The Vault */}
                            <div className="border border-[#2d3748] rounded-xl bg-[#1f242d]/30 overflow-hidden">
                                <div
                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#2d3748]/50 transition-colors"
                                    onClick={onToggleMemory}
                                >
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        🧠 The Vault <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full text-[10px]">{memoryCount}</span>
                                    </span>
                                    <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${showMemory ? "" : "-rotate-90"}`} />
                                </div>

                                <AnimatePresence>
                                    {showMemory && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: "auto" }}
                                            exit={{ height: 0 }}
                                            className="bg-[#161b22]"
                                        >
                                            <div className="p-2 space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                                                {memory.length > 0 ? (
                                                    memory.map((mem, i) => (
                                                        <div key={i} className="group relative p-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1f242d] transition-all break-words">
                                                            <div className="pr-4">{mem}</div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onForgetMemory(i); }}
                                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-900/20 p-1 rounded transition-all"
                                                                title="Forget"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-gray-600 italic px-2 py-2">
                                                        Type <code className="bg-white/5 px-1 rounded">/remember [text]</code> to add memories.
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={onExport}
                                    className="flex-1 flex items-center justify-center gap-2 bg-[#1f242d] hover:bg-[#2d3748] border border-[#2d3748] p-2 rounded-lg transition-colors text-xs text-gray-300 active:scale-95 duration-200"
                                >
                                    <Download size={14} /> Export
                                </button>
                                <button
                                    onClick={onClearAll}
                                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 p-2 rounded-lg transition-colors text-xs active:scale-95 duration-200"
                                >
                                    <Trash2 size={14} /> Clear All
                                </button>
                            </div>

                            <div className="text-[10px] text-center text-gray-600 pt-2 flex items-center justify-center gap-1">
                                Developed by SimplifAI-1
                            </div>

                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Overlay for mobile sidebar */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={onClose}
                />
            )}
        </>
    );
}; // Close Sidebar

const SessionItem = ({ session, isActive, onClick, onDelete }: { session: ChatSession, isActive: boolean, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) => (
    <div
        onClick={onClick}
        className={`group relative p-3 rounded-xl text-sm transition-all cursor-pointer border ${isActive
                ? "bg-indigo-600/20 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10"
                : "bg-[#1f242d]/30 border-transparent hover:bg-[#1f242d] hover:border-[#2d3748] text-gray-400 hover:text-gray-200"
            }`}
    >
        <div className="flex items-center gap-2 truncate pr-4">
            <MessageSquare size={14} className={isActive ? "text-indigo-400" : "text-gray-600"} />
            <span className="truncate">{session.title || "New Chat"}</span>
        </div>
        <button
            onClick={onDelete}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-all text-gray-500"
            title="Delete"
        >
            <Trash2 size={12} />
        </button>
    </div>
);
