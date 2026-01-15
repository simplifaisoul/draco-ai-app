"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter/dist/cjs/prism";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface CodeBlockProps {
    language: string;
    value: string;
}

export const CodeBlock = ({ language, value }: CodeBlockProps) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group rounded-lg overflow-hidden my-4 border border-[#2d3748] bg-[#0d1117]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#2d3748]">
                <span className="text-xs font-mono text-gray-400 lowercase">{language}</span>
                <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                    {copied ? (
                        <>
                            <Check size={14} className="text-green-400" />
                            <span className="text-green-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "0.875rem",
                }}
                wrapLines={true}
                wrapLongLines={true}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
};
