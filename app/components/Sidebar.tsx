import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Trash2, ChevronDown, X, Download, LogOut, User, Crown, Zap, Cpu, Settings } from "lucide-react";
import { HistoryManager, ChatSession } from "../lib/history";
import { useAuth } from "../lib/AuthContext";

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
    onJoinBeta?: () => void;
    userPlan?: string;
    onUpgrade?: () => void;
    onOpenAgent?: () => void;
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
    onJoinBeta,
    userPlan = 'free',
    onUpgrade,
    onOpenAgent
}) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const { user, signOut } = useAuth();

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

    const THEMES = [
        { id: 'cosmic' as const, label: 'Dark', color: 'bg-purple-500' },
        { id: 'corporate' as const, label: 'Light', color: 'bg-blue-500' },
        { id: 'neural' as const, label: 'Matrix', color: 'bg-emerald-500' },
    ];

    return (
        <>
            <AnimatePresence>
                {(isOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
                    <motion.aside
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`fixed md:relative shrink-0 z-50 w-[272px] h-full bg-[var(--sidebar-bg)]/80 backdrop-blur-2xl border-r border-[var(--border-color)] flex flex-col shadow-2xl md:shadow-none ${
                            isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                        }`}
                    >
                        {/* Header */}
                        <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
                            <div className="flex items-center gap-2.5">
                                <img src="/dragon_final.png" alt="Draco" className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.4)]" />
                                <span className="text-base font-bold bg-gradient-to-r from-[var(--foreground)] to-[var(--color-secondary)] bg-clip-text text-transparent tracking-tight">
                                    Draco AI
                                </span>
                            </div>
                            <button onClick={onClose} className="md:hidden p-1.5 rounded-lg text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="shrink-0 px-3 pt-2 pb-1 space-y-1.5">
                            <button
                                onClick={onNewChat}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)] hover:border-[var(--color-primary)]/20 text-sm font-medium text-[var(--foreground)] transition-all active:scale-[0.98] group"
                            >
                                <Plus size={16} className="text-[var(--color-primary)] group-hover:rotate-90 transition-transform duration-200" /> New Chat
                            </button>

                            <button
                                onClick={onOpenAgent}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/[0.06] to-cyan-500/[0.06] hover:from-emerald-500/[0.12] hover:to-cyan-500/[0.12] border border-emerald-500/10 hover:border-emerald-500/25 text-sm font-medium text-[var(--foreground)] transition-all active:scale-[0.98]"
                            >
                                <Cpu size={16} className="text-emerald-400" />
                                <span className="flex-1 text-left">Draco Agent</span>
                                {userPlan === 'free' && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold uppercase tracking-wider">Pro</span>
                                )}
                            </button>
                        </div>

                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 min-h-0">
                            {[
                                { label: "Today", items: groups.today },
                                { label: "Yesterday", items: groups.yesterday },
                                { label: "Previous 7 Days", items: groups.older },
                            ].map(group => group.items.length > 0 && (
                                <div key={group.label} className="mb-3">
                                    <div className="text-[10px] font-semibold text-[var(--color-secondary)] uppercase tracking-widest px-2 py-1.5">{group.label}</div>
                                    <div className="space-y-0.5">
                                        {group.items.map(s => (
                                            <SessionItem
                                                key={s.id}
                                                session={s}
                                                isActive={s.id === activeSessionId}
                                                onClick={() => onSessionSelect(s.id)}
                                                onDelete={(e) => handleDeleteSession(e, s.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {sessions.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <MessageSquare size={24} className="text-[var(--color-secondary)] opacity-20 mb-2" />
                                    <p className="text-xs text-[var(--color-secondary)] opacity-40">No conversations yet</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 border-t border-[var(--border-color)] px-3 py-3 space-y-2">
                            {/* Memory Vault */}
                            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] overflow-hidden">
                                <button
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors"
                                    onClick={onToggleMemory}
                                >
                                    <span className="text-[10px] font-bold text-[var(--color-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                                        🧠 Memory
                                        <span className="bg-[var(--color-primary)]/15 text-[var(--color-primary)] px-1.5 py-px rounded-full text-[9px] font-bold">{memoryCount}</span>
                                    </span>
                                    <ChevronDown size={12} className={`text-[var(--color-secondary)] transition-transform duration-200 ${showMemory ? "" : "-rotate-90"}`} />
                                </button>

                                <AnimatePresence>
                                    {showMemory && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: "auto" }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-2 pb-2 space-y-0.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                                                {memory.length > 0 ? (
                                                    memory.map((mem, i) => (
                                                        <div key={i} className="group relative px-2 py-1.5 rounded-lg text-[11px] text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all break-words pr-6">
                                                            {mem}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onForgetMemory(i); }}
                                                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-500/10 p-0.5 rounded transition-all"
                                                            >
                                                                <X size={9} />
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-[10px] text-[var(--color-secondary)] opacity-50 px-2 py-2">
                                                        Type <code className="bg-[var(--foreground)]/5 px-1 rounded text-[9px]">/remember</code> to save
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-1.5">
                                <button onClick={onExport}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)] text-[var(--color-secondary)] hover:text-[var(--foreground)] text-[10px] font-medium transition-all active:scale-[0.97]"
                                >
                                    <Download size={11} /> Export
                                </button>
                                <button onClick={onClearAll}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/[0.04] hover:bg-red-500/10 border border-red-500/[0.08] hover:border-red-500/15 text-red-400/50 hover:text-red-400 text-[10px] font-medium transition-all active:scale-[0.97]"
                                >
                                    <Trash2 size={11} /> Clear
                                </button>
                            </div>

                            {/* Theme Selector */}
                            <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border-color)]">
                                {THEMES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => onSetTheme(t.id)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                            currentTheme === t.id
                                                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] shadow-sm'
                                                : 'text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${t.color}`} />
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Upgrade / Plan */}
                            {userPlan === 'free' ? (
                                <button
                                    onClick={onUpgrade}
                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-500/15 hover:shadow-purple-500/25 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
                                >
                                    <Zap size={13} /> Upgrade to Pro
                                </button>
                            ) : (
                                <button
                                    onClick={onUpgrade}
                                    className="w-full py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)] text-[var(--color-secondary)] text-[11px] transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Crown size={11} className="text-yellow-400" /> Manage Plan
                                </button>
                            )}

                            {/* User Profile */}
                            {user && (
                                <div className="flex items-center gap-2 px-1 pt-1">
                                    <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/15 flex items-center justify-center shrink-0 overflow-hidden">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
                                        ) : (
                                            <User size={13} className="text-[var(--color-primary)]" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-medium text-[var(--foreground)] truncate flex items-center gap-1.5">
                                            {user.displayName || 'User'}
                                            {userPlan !== 'free' && (
                                                <span className="px-1 py-px rounded-sm bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 text-[7px] font-bold uppercase tracking-wider">
                                                    {userPlan}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-[var(--color-secondary)] truncate opacity-60">
                                            {user.email}
                                        </div>
                                    </div>
                                    <button
                                        onClick={signOut}
                                        className="p-1.5 rounded-lg text-[var(--color-secondary)] hover:text-red-400 hover:bg-red-500/8 transition-all"
                                        title="Sign Out"
                                    >
                                        <LogOut size={13} />
                                    </button>
                                </div>
                            )}
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
        className={`group relative px-2.5 py-2 rounded-lg text-[13px] transition-all cursor-pointer ${
            isActive
                ? "bg-[var(--color-primary)]/10 text-[var(--foreground)]"
                : "text-[var(--color-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        }`}
    >
        <div className="flex items-center gap-2 truncate pr-5">
            <MessageSquare size={13} className={isActive ? "text-[var(--color-primary)] shrink-0" : "text-[var(--color-secondary)] shrink-0 opacity-40"} />
            <span className="truncate">{session.title || "New Chat"}</span>
        </div>
        <button
            onClick={onDelete}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-all text-[var(--color-secondary)]"
            title="Delete"
        >
            <Trash2 size={11} />
        </button>
    </div>
);
