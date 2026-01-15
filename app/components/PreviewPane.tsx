import React, { useEffect, useRef } from "react";
import { X, ExternalLink, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface PreviewPaneProps {
    code: string;
    language: string;
    onClose: () => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({ code, language, onClose }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Basic template wrapper for the code
    const getSrcDoc = (code: string, lang: string) => {
        if (lang === "html" || lang === "xml") {
            // Check if it's a full HTML doc or just a snippet
            const hasHead = code.includes("<head>");
            const hasBody = code.includes("<body>");

            if (hasHead && hasBody) return code;

            // Wrap snippet
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { background-color: #0f1117; color: #f8fafc; font-family: sans-serif; padding: 1rem; }
                    </style>
                </head>
                <body>
                    ${code}
                </body>
                </html>
            `;
        }

        // For JS/React, we can try to render it but it's harder without a bundler.
        // For now, let's just assume HTML/CSS support for visual previews.
        return `
            <html><body style="color: white;">Preview not supported for ${lang} yet. Usage: Write HTML/Tailwind.</body></html>
        `;
    };

    useEffect(() => {
        if (iframeRef.current) {
            iframeRef.current.srcdoc = getSrcDoc(code, language);
        }
    }, [code, language]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="flex-1 h-full bg-[#161b22] border-l border-[#2d3748] flex flex-col relative z-20 shadow-2xl"
        >
            <div className="flex items-center justify-between p-3 border-b border-[#2d3748] bg-[#0f1117]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Preview
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => iframeRef.current && (iframeRef.current.srcdoc = getSrcDoc(code, language))}
                        className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
                        title="Reload"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
            <div className="flex-1 relative bg-white/5">
                <iframe
                    ref={iframeRef}
                    className="w-full h-full border-none bg-white"
                    title="Live Preview"
                    sandbox="allow-scripts"
                />
            </div>
        </motion.div>
    );
};
