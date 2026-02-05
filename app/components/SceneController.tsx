"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type SceneTheme = "cosmic" | "corporate" | "neural";

interface SceneContextType {
    theme: SceneTheme;
    setTheme: (theme: SceneTheme) => void;
}

const SceneContext = createContext<SceneContextType>({ theme: "cosmic", setTheme: () => { } });

export const useScene = () => useContext(SceneContext);

export function SceneController({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<SceneTheme>("cosmic");

    const [mounted, setMounted] = useState(false);

    // Persist preference
    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem("draco_scene");
        if (saved) setTheme(saved as SceneTheme);
    }, []);

    const handleSetTheme = (t: SceneTheme) => {
        setTheme(t);
        localStorage.setItem("draco_scene", t);
    };

    if (!mounted) {
        return <>{children}</>; // Render only children on server/initial client to match
    }

    return (
        <SceneContext.Provider value={{ theme, setTheme: handleSetTheme }}>
            <div className={`relative w-full h-full transition-colors duration-700 ${theme}`}>
                {/* Dynamic Background Layer */}
                <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-1000">
                    <AnimatePresence mode="wait">
                        {theme === "cosmic" && (
                            <motion.div
                                key="cosmic"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1 }}
                                className="absolute inset-0 bg-[#000000]"
                            >
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]"></div>
                            </motion.div>
                        )}
                        {theme === "corporate" && (
                            <motion.div
                                key="corporate"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1 }}
                                className="absolute inset-0 bg-gradient-to-br from-slate-50 to-purple-50"
                            >
                                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-200/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-200/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
                            </motion.div>
                        )}
                        {theme === "neural" && (
                            <motion.div
                                key="neural"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1 }}
                                className="absolute inset-0 bg-black"
                            >
                                {/* Abstract Grid */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content */}
                <div className="relative z-10 h-full">
                    {children}
                </div>
            </div>
        </SceneContext.Provider>
    );
}

// Helper component for the Header Link
export function BrandLink() {
    const { theme } = useScene();
    return (
        <a
            href="https://simplifai-1.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold tracking-widest uppercase transition-colors px-3 py-1 rounded-full border text-[var(--color-secondary)] border-[var(--border-color)] hover:bg-[var(--foreground)]/5 hover:text-[var(--foreground)]"
        >
            Made by SimplifAI-1
        </a>
    );
}
