import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Plus, MessageSquare, Trash2, ChevronDown, X, Download } from "lucide-react";
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
    currentTheme: 'cosmic' | 'corporate' | 'neural';
    onSetTheme: (theme: 'cosmic' | 'corporate' | 'neural') => void;
    onJoinBeta: () => void;
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
    onForgetMemory,
    currentTheme,
    onSetTheme,
    onJoinBeta
}) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);

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
                        className={`fixed md:relative shrink-0 md:shrink-0 z-50 w-[280px] h-full bg-[var(--sidebar-bg)]/60 backdrop-blur-2xl border-r border-white/10 flex flex-col p-4 shadow-2xl md:shadow-none transition-colors duration-500 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent font-mono">
                                    <Bot className="text-[var(--color-primary)]" /> Draco V0.4
                                </div>
                                <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[9px] text-[var(--color-primary)] font-mono tracking-wider">
                                    AGENTIC
                                </span>
                            </div>
                            <button onClick={onClose} className="md:hidden text-gray-400 p-2 hover:bg-white/5 rounded-full">
                                <X />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 mb-4">
                            <button
                                onClick={onNewChat}
                                className="w-full flex items-center gap-2 bg-[var(--input-bg)] hover:bg-[var(--border-color)] border border-[var(--border-color)] p-3 rounded-xl text-sm font-medium transition-colors active:scale-95 duration-200 shadow-lg shadow-black/5 text-[var(--foreground)]"
                            >
                                <Plus size={18} className="text-[var(--color-primary)]" /> New Chat
                            </button>

                            {/* Agent Mode Trigger */}
                            <button
                                onClick={onJoinBeta}
                                className="w-full relative overflow-hidden group flex items-center gap-2 bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/20 p-3 rounded-xl text-sm font-medium transition-all hover:border-purple-500/50 active:scale-95 duration-200 text-purple-200"
                            >
                                <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
                                <div className="relative flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <span className="text-purple-400">⚡</span> Agent Mode
                                    </div>
                                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                                        LOCKED
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* History List */}
                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                            {groups.today.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-2 px-2 mt-4">Today</div>
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
                                    <div className="text-xs font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-2 px-2 mt-4">Yesterday</div>
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
                                    <div className="text-xs font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-2 px-2 mt-4">Previous 7 Days</div>
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
                                <div className="p-4 text-xs text-[var(--color-secondary)] text-center italic mt-10">
                                    No conversation history.<br />Start a new chat!
                                </div>
                            )}
                        </div>

                        {/* Footer / Utilities */}
                        <div className="mt-4 border-t border-[var(--border-color)] pt-4 space-y-2">

                            {/* The Vault */}
                            <div className="border border-[var(--border-color)] rounded-xl bg-[var(--input-bg)]/30 overflow-hidden">
                                <div
                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--border-color)]/50 transition-colors"
                                    onClick={onToggleMemory}
                                >
                                    <span className="text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider flex items-center gap-2">
                                        🧠 The Vault <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-1.5 py-0.5 rounded-full text-[10px]">{memoryCount}</span>
                                    </span>
                                    <ChevronDown size={14} className={`text-[var(--color-secondary)] transition-transform duration-200 ${showMemory ? "" : "-rotate-90"}`} />
                                </div>

                                <AnimatePresence>
                                    {showMemory && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: "auto" }}
                                            exit={{ height: 0 }}
                                            className="bg-[var(--sidebar-bg)]"
                                        >
                                            <div className="p-2 space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                                                {memory.length > 0 ? (
                                                    memory.map((mem, i) => (
                                                        <div key={i} className="group relative p-2 rounded-lg text-xs text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--input-bg)] transition-all break-words">
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
                                                    <div className="text-xs text-[var(--color-secondary)] italic px-2 py-2">
                                                        Type <code className="bg-[var(--foreground)]/5 px-1 rounded">/remember [text]</code> to add memories.
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
                                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--input-bg)] hover:bg-[var(--border-color)] border border-[var(--border-color)] p-2 rounded-lg transition-colors text-xs text-[var(--foreground)] active:scale-95 duration-200"
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

                            {/* Mobile Theme Selector (Visible in Sidebar) */}
                            <div className="pt-2">
                                <div className="text-[10px] font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-1.5 px-1">Theme</div>
                                <div className="grid grid-cols-3 gap-1 bg-[var(--input-bg)]/50 p-1 rounded-xl border border-[var(--border-color)]">
                                    {(['cosmic', 'corporate', 'neural'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => onSetTheme(t)}
                                            className={`px-1 py-1.5 rounded-lg text-[10px] uppercase font-bold transition-all ${currentTheme === t
                                                ? 'bg-[var(--color-primary)] text-white shadow-md'
                                                : 'text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/50'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-2 pt-3 border-t border-[var(--border-color)]">
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[var(--color-secondary)] opacity-80 mb-3">
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Systems Stable</div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" /> Serper Active</div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]" /> Proxy Ready</div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]" /> Deep Fetch</div>
                                </div>
                                <div className="text-[10px] text-center text-[var(--color-secondary)] opacity-50 hover:opacity-100 transition-opacity">
                                    Built by SimplifAI-1
                                </div>
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
};

const SessionItem = ({ session, isActive, onClick, onDelete }: { session: ChatSession, isActive: boolean, onClick: () => void, onDelete: (e: React.MouseEvent) => void }) => (
    <div
        onClick={onClick}
        className={`group relative p-3 rounded-xl text-sm transition-all cursor-pointer border ${isActive
            ? "bg-[var(--color-primary)]/20 border-[var(--color-primary)]/50 text-[var(--foreground)] shadow-lg shadow-[var(--color-primary)]/10"
            : "bg-[var(--input-bg)]/30 border-transparent hover:bg-[var(--input-bg)] hover:border-[var(--border-color)] text-[var(--color-secondary)] hover:text-[var(--foreground)]"
            }`}
    >
        <div className="flex items-center gap-2 truncate pr-4">
            <MessageSquare size={14} className={isActive ? "text-[var(--color-primary)]" : "text-[var(--color-secondary)]"} />
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
