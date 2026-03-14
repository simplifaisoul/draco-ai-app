"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
    role: string;
    content: string;
    timestamp?: string;
}

interface SharedChatClientProps {
    messages: Message[];
    title: string;
    createdAt: string;
    shareId: string;
}

export default function SharedChatClient({ messages, title, createdAt, shareId }: SharedChatClientProps) {
    const formattedDate = createdAt
        ? new Date(createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <a href="https://dracoai.app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src="/dragon_final.png" alt="Draco" className="w-7 h-7 object-contain" />
                        <span className="text-sm font-bold text-white/80">Draco AI</span>
                    </a>
                    <a
                        href="https://dracoai.app"
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition-all hover:scale-105 shadow-md shadow-purple-500/20"
                    >
                        Try Draco AI →
                    </a>
                </div>
            </header>

            {/* Chat title */}
            <div className="max-w-3xl mx-auto px-4 pt-10 pb-6">
                <div className="flex items-center gap-2 mb-2">
                    <div className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-medium uppercase tracking-wider">
                        Shared Chat
                    </div>
                    {formattedDate && (
                        <span className="text-white/20 text-[11px]">{formattedDate}</span>
                    )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{title}</h1>
            </div>

            {/* Messages */}
            <div className="max-w-3xl mx-auto px-4 pb-20 space-y-6">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`relative max-w-[85%] p-4 rounded-2xl text-sm md:text-base leading-relaxed ${msg.role === "user"
                                    ? "bg-purple-600/20 text-white rounded-br-none border border-purple-500/20"
                                    : "bg-white/[0.03] text-white/90 rounded-bl-none border border-white/10"
                                }`}
                        >
                            {/* Role label */}
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${msg.role === "user" ? "text-purple-400/60" : "text-emerald-400/60"
                                }`}>
                                {msg.role === "user" ? "User" : "Draco AI"}
                            </div>

                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code({ node, inline, className, children, ...props }: any) {
                                        const match = /language-(\w+)/.exec(className || "");
                                        return !inline && match ? (
                                            <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto my-3 border border-white/5">
                                                <code className="text-xs font-mono text-green-300" {...props}>
                                                    {children}
                                                </code>
                                            </pre>
                                        ) : (
                                            <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs text-purple-300 border border-white/5" {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    a: ({ node, ...props }: any) => (
                                        <a {...props} className="text-purple-400 hover:text-purple-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" />
                                    ),
                                    img: ({ node, ...props }: any) => (
                                        <img {...props} className="rounded-xl max-w-full my-3 border border-white/10" loading="lazy" />
                                    ),
                                    table: ({ node, ...props }: any) => (
                                        <div className="overflow-x-auto my-4 border border-white/10 rounded-lg">
                                            <table className="min-w-full text-sm" {...props} />
                                        </div>
                                    ),
                                    th: ({ node, ...props }: any) => (
                                        <th className="px-4 py-2 text-left text-xs font-bold text-white/60 bg-white/5 border-b border-white/10" {...props} />
                                    ),
                                    td: ({ node, ...props }: any) => (
                                        <td className="px-4 py-2 text-sm border-b border-white/5" {...props} />
                                    ),
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>

                            {/* Timestamp */}
                            {msg.timestamp && (
                                <div className="text-[10px] text-white/15 mt-2">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* CTA Footer */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0a0a0f]/90 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <p className="text-white/30 text-xs">
                        This conversation was shared from <span className="text-purple-400 font-medium">Draco AI</span>
                    </p>
                    <a
                        href="https://dracoai.app"
                        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/20"
                    >
                        Start your own chat →
                    </a>
                </div>
            </div>
        </div>
    );
}
