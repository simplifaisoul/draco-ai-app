import { motion } from "framer-motion";

interface AudioVisualizerProps {
    isListening: boolean;
}

export const AudioVisualizer = ({ isListening }: AudioVisualizerProps) => {
    if (!isListening) return null;

    return (
        <div className="flex items-end justify-center gap-1 h-6 w-10">
            {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                    key={i}
                    className="w-1 bg-red-400 rounded-full"
                    animate={{
                        height: ["20%", "80%", "40%"],
                    }}
                    transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        repeatType: "mirror",
                        delay: i * 0.1,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
};
