import { X } from "lucide-react";
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
            <div className="relative bg-[#161b22] border border-[#2d3748] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* System Prompt */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">System Prompt (Persona)</label>
                        <textarea
                            value={localSettings.systemPrompt}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                            className="w-full bg-[#0f1117] border border-[#2d3748] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                            placeholder="You are Draco AI..."
                        />
                        <p className="text-xs text-gray-500">Define how the AI should behave.</p>
                    </div>

                    {/* Voice Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">AI Voice</label>
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

                <div className="mt-8 flex justify-end gap-3">
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
