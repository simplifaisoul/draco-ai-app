import { X, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface Settings {
    systemPrompt: string;
    voiceURI: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSave: (settings: Settings) => void;
}

const PERSONAS = [
    { id: "default", name: "Draco (Default)", prompt: "You are Draco AI. Helpful, smart, and concise. Format code nicely." },
    { id: "coder", name: "👩‍💻 Expert Coder", prompt: "You are an expert Senior Software Engineer. You write clean, efficient, and well-documented code. You prefer TypeScript and Tailwind CSS. Always explain your technical decisions." },
    { id: "roast", name: "🔥 Roast Master", prompt: "You are a cynical, witty AI who loves to roast the user while still being helpful. Use emojis and savage humor. Don't hold back." },
    { id: "tutor", name: "🎓 ELI5 Tutor", prompt: "You are a patient and encouraging teacher. Explain complex topics like I'm 5 years old. Use analogies and simple language." },
    { id: "poet", name: "📜 The Bard", prompt: "You are a poetic AI. Speak in rhymes or riddles occasionally. Use archaic but understandable language. Be dramatic." },
];

export const SettingsModal = ({ isOpen, onClose, settings, onSave }: SettingsModalProps) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        const loadVoices = () => {
            const vs = window.speechSynthesis.getVoices();
            setVoices(vs);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#161b22] border border-[#2d3748] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="text-indigo-400" size={20} /> Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
                    {/* System Prompt */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Persona Library</label>
                        <div className="flex flex-wrap gap-2">
                            {PERSONAS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, systemPrompt: p.prompt }))}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${localSettings.systemPrompt === p.prompt
                                            ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                                            : "bg-[#0f1117] border-[#2d3748] text-gray-400 hover:border-gray-500 hover:text-white"
                                        }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>

                        <label className="text-sm font-medium text-gray-300 block mt-2">Active System Prompt</label>
                        <textarea
                            value={localSettings.systemPrompt}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                            className="w-full bg-[#0f1117] border border-[#2d3748] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                            placeholder="You are Draco AI..."
                        />
                        <p className="text-xs text-gray-500">Customize the AI's behavior or choose a preset above.</p>
                    </div>

                    {/* Voice Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">AI Voice (Text-to-Speech)</label>
                        <select
                            value={localSettings.voiceURI}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, voiceURI: e.target.value }))}
                            className="w-full bg-[#0f1117] border border-[#2d3748] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">Default System Voice</option>
                            {voices.map(v => (
                                <option key={v.voiceURI} value={v.voiceURI}>
                                    {v.name} ({v.lang})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3 shrink-0 pt-4 border-t border-[#2d3748]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onSave(localSettings); onClose(); }}
                        className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-500/20"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

