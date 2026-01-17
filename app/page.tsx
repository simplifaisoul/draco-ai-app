"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Menu, Plus, MessageSquare, X, ChevronDown, Bot, User, Trash2, Globe, Image as ImageIcon, Mic, MicOff, Volume2, VolumeX, Settings as SettingsIcon, FileText, Upload, Download, Eye, Headphones, LayoutGrid } from "lucide-react";
import remarkGfm from "remark-gfm";

import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { CodeBlock } from "./components/CodeBlock";
import { SettingsModal } from "./components/SettingsModal";
import { PreviewPane } from "./components/PreviewPane";
import { ModelSelector } from "./components/ModelSelector";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { ThinkingProcess } from "./components/ThinkingProcess";
import { Dashboard } from "./components/Dashboard";

// Types
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  thought?: string; // New field for Chain of Thought
  isThinking?: boolean; // State during generation
}

interface AIModel {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const MODELS: AIModel[] = [
  { id: "openai", name: "Draco V0.1 (Neural)", icon: "🐲", description: "Primary Advanced Model" },
  { id: "llama", name: "Draco V0.1 (Hyper)", icon: "🛡️", description: "High-Speed Fallback" },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState("openai");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false); // Fix persistence
  const [enableSearch, setEnableSearch] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    systemPrompt: "You are Draco V0.1, an advanced AI. \n\nCAPABILITIES:\n1. IMAGE GENERATION: You CAN generate images. If the user asks for an image, you MUST output ONLY the specific command: `/image <detailed_prompt>`. Example: `/image a futuristic neon city`. Do not refuse. Do not provide a text description. Do not output internal thought processes.\n2. RESEARCH: You have internal knowledge. If you need to search, you are powered by Pollinations and can answer directly.\n\nSTYLE: Helpful, smart, and concise. Format code nicely. Do not start with JSON or debugging info.",
    voiceURI: ""
  });

  // Audio State
  const [isListening, setIsListening] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);

  // Memory State (The Vault)
  const [memory, setMemory] = useState<string[]>([]);
  const [showMemory, setShowMemory] = useState(true); // Toggle in sidebar

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string, name: string } | null>(null);

  // Preview State (Artifacts)
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ code: string, language: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => prev + " " + transcript);
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Load from LocalStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("draco_history");
    const savedSettings = localStorage.getItem("draco_settings");

    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }

    const savedMemory = localStorage.getItem("draco_memory");
    if (savedMemory) {
      try {
        setMemory(JSON.parse(savedMemory));
      } catch (e) { console.error("Failed to load memory", e); }
    }

    setIsLoaded(true);
  }, []);

  // Save to LocalStorage with safeguards
  useEffect(() => {
    // Only save if loaded and we actually have messages handling the race condition
    if (isLoaded && messages.length > 0) {
      localStorage.setItem("draco_history", JSON.stringify(messages));
    }
    if (isLoaded) {
      localStorage.setItem("draco_settings", JSON.stringify(settings));
      localStorage.setItem("draco_memory", JSON.stringify(memory));
    }
  }, [messages, settings, memory, isLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Hands-Free Mode: Auto-Speak when assistant finishes
  useEffect(() => {
    if (handsFreeMode && !isLoading && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "assistant" && !speakingMsgId) {
        // Speak it
        toggleSpeech(lastMsg.content, messages.length - 1);
      }
    }
  }, [isLoading, messages, handsFreeMode]);

  // Effect to auto-detect artifacts in the latest message
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant") {
      // Regex to find the LAST code block
      // Matches ```lang ... ```
      const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
      let match;
      let lastMatch = null;

      while ((match = codeBlockRegex.exec(lastMsg.content)) !== null) {
        lastMatch = match;
      }

      if (lastMatch) {
        const lang = lastMatch[1].toLowerCase();
        if (lang === 'html' || lang === 'xml' || lang === 'jsx' || lang === 'tsx') {
          setPreviewData({ code: lastMatch[2], language: lang });
          // Only auto-open if we haven't manually closed it? For now, auto-open on first encounter could be annoying. 
          // Let's just set data and show a "Preview Available" indicator unless forced.
          // Actually, let's auto-open if it's the *very first* time detecting in this stream?
          // Promoting user control: Just ensure data is there.
        }
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearHistory = () => {
    if (confirm("Clear all chat history?")) {
      setMessages([]);
      localStorage.removeItem("draco_history");
      setSidebarOpen(false);
    }
  };

  const exportChat = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `draco_chat_${new Date().toISOString()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error("Export failed:", e);
      alert("Failed to export chat.");
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleSpeech = (text: string, index: number) => {
    if (speakingMsgId === index) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (settings.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
        if (selectedVoice) utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        setSpeakingMsgId(null);
        // Auto-Listen if Hands-Free
        if (handsFreeMode) {
          setTimeout(() => {
            if (recognitionRef.current && !isListening) {
              recognitionRef.current.start();
              setIsListening(true);
            }
          }, 500); // Short delay for natural turn-taking
        }
      };

      window.speechSynthesis.speak(utterance);
      setSpeakingMsgId(index);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          setAttachment({ url: result, name: file.name });
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("text/") || file.name.endsWith(".js") || file.name.endsWith(".ts") || file.name.endsWith(".tsx") || file.name.endsWith(".json") || file.name.endsWith(".md") || file.name.endsWith(".py")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setInput(prev => prev + `\n\n[File: ${file.name}]\n\`\`\`\n${content}\n\`\`\`\n`);
        };
        reader.readAsText(file);
      } else {
        console.log("Ignored non-text/non-image file:", file.name);
      }
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    window.speechSynthesis.cancel(); // Stop speaking if user interrupts
    setSpeakingMsgId(null);

    const originalInput = input.trim();
    // For UI display, if there's an attachment, append it as markdown image
    const uiContent = attachment ? `${originalInput}\n\n![${attachment.name}](${attachment.url})` : originalInput;

    const userMsg: Message = { role: "user", content: uiContent, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachment(null); // Clear attachment
    setIsLoading(true);

    try {
      // 1. Check for Image Command
      if (originalInput.startsWith("/image") || originalInput.startsWith("/draw")) {
        const prompt = originalInput.replace(/^\/(image|draw)\s*/i, "").trim();
        if (!prompt) {
          setMessages(prev => [...prev, { role: "assistant", content: "Please provide a description for the image. Example: `/image neon dragon`", timestamp: new Date().toISOString() }]);
          setIsLoading(false);
          return;
        }

        const encodedPrompt = encodeURIComponent(prompt);
        const randomSeed = Math.floor(Math.random() * 10000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=768&nologo=true`;

        await new Promise(r => setTimeout(r, 600));

        const imageMsg: Message = {
          role: "assistant",
          content: `Here is your generated image for "**${prompt}**":\n\n![Generated Image](${imageUrl})`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, imageMsg]);
        setIsLoading(false);
        return;
      }

      // 1.5. Check for Memory Commands
      if (originalInput.startsWith("/remember ")) {
        const textToRemember = originalInput.replace("/remember ", "").trim();
        if (textToRemember) {
          setMemory(prev => [...prev, textToRemember]);
          setMessages(prev => [...prev, { role: "assistant", content: `🧠 I've stored that in The Vault: "${textToRemember}"`, timestamp: new Date().toISOString() }]);
          setIsLoading(false);
          return;
        }
      }
      if (originalInput.startsWith("/forget ")) {
        const indexStr = originalInput.replace("/forget ", "").trim();
        const index = parseInt(indexStr) - 1; // User uses 1-based index usually, or we assume they use UI
        // Actually, let's just support clearing all or UI deletion.
        // Command support is tricky without IDs. Let's redirect to UI.
        setMessages(prev => [...prev, { role: "assistant", content: "To forget something, please use the 'The Vault' section in the sidebar.", timestamp: new Date().toISOString() }]);
        setIsLoading(false);
        return;
      }

      // 2. Determine Model & System Prompt
      let activeModel = currentModel;
      // Search is handled by model capabilities now


      // 3. Streaming Request

      // Inject Memory into System Prompt of "messagesPayload" only, not the visible setting
      const vaultContext = memory.length > 0 ? `\n\n[THE VAULT - LONG TERM MEMORY]:\n${memory.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\n[INSTRUCTION]: Use the above memory to personalize your response if relevant.` : "";
      const finalSystemPrompt = settings.systemPrompt + vaultContext;

      const messagesPayload = [
        { role: "system", content: finalSystemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      // Add current message. If attachment, format as multimodal.
      if (attachment) {
        // Force visually capable model if possible, though 'openai' default is 4o which is good.
        // activeModel = 'openai'; 

        messagesPayload.push({
          role: "user",
          content: [
            { type: "text", text: originalInput },
            { type: "image_url", image_url: { url: attachment.url } }
          ]
        } as any); // Type assertion needed because simple Message interface uses string content
      } else {
        messagesPayload.push({ role: "user", content: originalInput });
      }

      // Use dynamic endpoint for better stability per model
      // Fallback to 'openai' if model is weird, but usually model name in path works best for Pollinations
      // Use backend API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesPayload,
          model: activeModel,
        }),
      });

      if (response.status === 429) {
        setMessages(prev => [...prev, { role: "assistant", content: "⏳ Rate limit exceeded. Please wait a moment.", timestamp: new Date().toISOString() }]);
        setIsLoading(false);
        return;
      }

      if (!response.ok) throw new Error("API Error");

      const data = await response.json();

      // Fix: Ensure we extract string content, not object
      let content = data.response;
      if (typeof content === 'object') {
        content = JSON.stringify(content); // Fallback: Stringify if still object
      }

      const provider = data.provider;

      // Check for AI-triggered Image Command
      if (content.trim().startsWith("/image") || content.trim().startsWith("/draw")) {
        const prompt = content.replace(/^\/(image|draw)\s*/i, "").trim();
        const encodedPrompt = encodeURIComponent(prompt);
        const randomSeed = Math.floor(Math.random() * 10000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=768&nologo=true`;
        content = `Generated image for "**${prompt}**":\n\n![Generated Image](${imageUrl})`;
      }

      // Update message with full content
      setMessages(prev => [...prev, {
        role: "assistant",
        content: content,
        timestamp: new Date().toISOString(),
        thought: data.cached ? "⚡ Cached Response" : undefined,
        isThinking: false
      }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error connecting to AI. Please try again.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex h-[100dvh] bg-[#0f1117] text-[#f8fafc] font-sans overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-indigo-500/20 backdrop-blur-sm border-4 border-indigo-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload size={64} className="text-indigo-400 mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">Drop text files here</h2>
            <p className="text-indigo-200 mt-2">I can read code and text files!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />

      <AnimatePresence>
        {dashboardOpen && (
          <Dashboard
            isOpen={dashboardOpen}
            onClose={() => setDashboardOpen(false)}
            stats={{ messageCount: messages.length, memoryCount: memory.length }}
            onVibeSelect={(prompt) => setSettings(prev => ({ ...prev, systemPrompt: prompt }))}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      </div>

      {/* Sidebar - Desktop & Mobile */}
      <AnimatePresence>
        {(sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed md:relative z-50 w-[280px] h-full bg-[#161b22]/95 backdrop-blur-xl border-r border-[#2d3748] flex flex-col p-4 shadow-2xl md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
              }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent font-mono">
                <Bot className="text-indigo-500" /> Draco.AI
              </div>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 p-2 hover:bg-white/5 rounded-full">
                <X />
              </button>
            </div>

            <button
              onClick={() => { setMessages([]); localStorage.removeItem("draco_history"); setInput(""); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2 bg-[#1f242d] hover:bg-[#2d3748] border border-[#2d3748] p-3 rounded-xl text-sm font-medium transition-colors mb-2 active:scale-95 duration-200"
            >
              <Plus size={18} /> New Chat
            </button>

            <button
              onClick={exportChat}
              className="w-full flex items-center gap-2 bg-[#1f242d] hover:bg-[#2d3748] border border-[#2d3748] p-3 rounded-xl text-sm font-medium transition-colors mb-4 active:scale-95 duration-200"
            >
              <Download size={18} /> Export Chat
            </button>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Recent</div>
              {messages.length > 0 ? (
                <div className="p-3 bg-[#1f242d]/50 rounded-xl text-sm text-gray-300 truncate border border-[#2d3748]/50">
                  <MessageSquare size={14} className="inline mr-2 text-indigo-400" />
                  {messages[0]?.content.substring(0, 20)}...
                </div>
              ) : (
                <div className="p-4 text-xs text-gray-500 text-center italic">No history yet</div>
              )}
            </div>

            <button onClick={clearHistory} className="mt-4 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-lg transition-colors text-sm">
              <Trash2 size={14} /> Clear History
            </button>

            {/* The Vault (Memory) */}
            <div className="mt-6 border-t border-[#2d3748] pt-4">
              <div
                className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2 cursor-pointer hover:text-gray-300 transition-colors"
                onClick={() => setShowMemory(!showMemory)}
              >
                <span>🧠 The Vault ({memory.length})</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showMemory ? "" : "-rotate-90"}`} />
              </div>

              <AnimatePresence>
                {showMemory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {memory.length > 0 ? (
                      memory.map((mem, i) => (
                        <div key={i} className="group relative p-2 bg-[#1f242d]/30 rounded-lg border border-[#2d3748]/50 text-xs text-gray-400 hover:text-gray-200 hover:border-indigo-500/30 transition-all">
                          <div className="pr-4">{mem}</div>
                          <button
                            onClick={() => setMemory(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-900/20 p-1 rounded transition-all"
                            title="Forget"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-600 italic px-2">
                        Type <code className="bg-white/5 px-1 rounded">/remember [text]</code> to add memories.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-transparent z-10">
        {/* Header */}
        <header className="h-16 border-b border-[#2d3748/50] flex items-center justify-between px-4 bg-[#0f1117]/80 backdrop-blur-xl z-30 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-3 w-full">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 p-2 hover:bg-white/5 rounded-lg active:scale-95">
              <Menu />
            </button>

            <div className="relative group flex-1 md:flex-none max-w-[200px]">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <span className="text-xs mr-1 opacity-50">Model:</span>
              </div>
              <select
                value={currentModel}
                onChange={(e) => setCurrentModel(e.target.value)}
                className="w-full appearance-none bg-[#1f242d] border border-[#2d3748] text-white py-2 pl-12 pr-8 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-[#2d3748] transition-colors shadow-lg"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            {/* Search Toggle */}
            <button
              onClick={() => setDashboardOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hidden md:block" // Hidden on mobile to save space? or not?
              title="Dashboard"
            >
              <LayoutGrid size={18} />
            </button>

            {/* Search Toggle Removed */}

            {/* Preview Toggle (Artifacts) */}
            {previewData && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2 rounded-lg transition-all border ${showPreview
                  ? "bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                  : "text-green-500/50 border-transparent hover:bg-white/5 animate-pulse"
                  }`}
                title="Toggle Live Preview"
              >
                <Eye size={18} />
              </button>
            )}

            {/* Settings Toggle */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent"
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </header>

        {/* Content Container (Chat + Preview) */}
        <div className="flex-1 overflow-hidden relative flex">

          {/* Chat Area */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden pt-20 pb-[120px] px-4 md:px-8 scroll-smooth custom-scrollbar transition-all duration-300 ${showPreview ? "hidden md:block md:w-1/2 md:max-w-[50%]" : "w-full"}`}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-90 px-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-indigo-500/10 p-6 rounded-full mb-6 relative group"
                >
                  <div className="text-6xl animate-pulse group-hover:scale-110 transition-transform duration-500">🐉</div>
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse delay-75"></div>
                </motion.div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-3 bg-[length:200%_auto] animate-gradient">
                  Draco.AI
                </h1>
                <p className="text-gray-400 max-w-md text-sm md:text-base leading-relaxed mb-8">
                  Your premium AI companion. <br />
                  <span className="text-indigo-400">Streaming • Voice • Persistent • Artifacts</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl">
                  {MODELS.slice(0, 3).map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-[#1f242d]/60 backdrop-blur-sm border border-[#2d3748] p-4 rounded-xl text-left hover:border-indigo-500/50 hover:bg-[#1f242d]/80 transition-all cursor-pointer group active:scale-[0.98] shadow-lg"
                      onClick={() => setCurrentModel(m.id)}
                    >
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">{m.icon}</div>
                      <div className="font-semibold text-sm text-gray-200">{m.name}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`max-w-3xl mx-auto space-y-6 ${showPreview ? "max-w-full px-2" : ""}`}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30 mt-1 shadow-lg shadow-indigo-500/10">
                          <Bot size={16} className="text-indigo-400" />
                        </div>
                        <button
                          onClick={() => toggleSpeech(msg.content, i)}
                          className={`p-1 rounded-full hover:bg-white/5 transition-colors ${speakingMsgId === i ? "text-indigo-400" : "text-gray-500"}`}
                          title="Read Aloud"
                        >
                          {speakingMsgId === i ? <Volume2 size={14} /> : <VolumeX size={14} className="opacity-50 hover:opacity-100" />}
                        </button>
                      </div>
                    )}

                    <div className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-3 md:px-5 md:py-4 text-sm md:text-base leading-relaxed backdrop-blur-sm transition-all duration-300 ${msg.role === "user"
                      ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-lg shadow-indigo-900/20"
                      : "bg-[#1e232e]/90 border border-[#2d3748] text-gray-100 rounded-bl-sm shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/20"
                      }`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            return !inline && match ? (
                              <CodeBlock
                                language={match[1]}
                                value={String(children).replace(/\n$/, "")}
                              />
                            ) : (
                              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs text-indigo-200 border border-white/5" {...props}>
                                {children}
                              </code>
                            )
                          },
                          table: ({ node, ...props }: any) => (
                            <div className="overflow-x-auto my-4 border border-[#2d3748] rounded-lg">
                              <table className="min-w-full divide-y divide-[#2d3748] text-sm text-left" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }: any) => <thead className="bg-[#1f242d] text-gray-200" {...props} />,
                          th: ({ node, ...props }: any) => <th className="px-4 py-3 text-left font-medium uppercase tracking-wider" {...props} />,
                          tbody: ({ node, ...props }: any) => <tbody className="bg-[#161b22] divide-y divide-[#2d3748] text-gray-300" {...props} />,
                          tr: ({ node, ...props }: any) => <tr className="hover:bg-[#1f242d]/50 transition-colors" {...props} />,
                          td: ({ node, ...props }: any) => <td className="px-4 py-3 whitespace-nowrap" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0 border border-purple-500/30 mt-1">
                        <User size={16} className="text-purple-400" />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Only show loading dots if we are waiting for API, NOT while streaming */}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                      <Bot size={16} className="text-indigo-400" />
                    </div>
                    <div className="bg-[#1e232e]/80 border border-[#2d3748] px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1 shadow-lg">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Preview Pane (Split Screen) */}
          <AnimatePresence>
            {showPreview && previewData && (
              <PreviewPane
                code={previewData.code}
                language={previewData.language}
                onClose={() => setShowPreview(false)}
              />
            )}
          </AnimatePresence>

        </div>

        {/* Input Area (Modified to account for split screen?) */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0f1117] via-[#0f1117]/95 to-transparent z-40 flex justify-center backdrop-blur-sm transition-all duration-300 ${showPreview ? "md:w-1/2" : "w-full"}`}>
          <div className="w-full max-w-3xl bg-[#1f242d] border border-[#2d3748] rounded-[24px] p-2 pl-4 flex items-end gap-2 shadow-2xl shadow-black/50 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={enableSearch ? "Ask Draco to search the web..." : "Message Draco (or type /image)..."}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 resize-none max-h-32 py-3 text-base md:text-sm custom-scrollbar"
              rows={1}
              style={{ minHeight: "44px" }}
            />
            {/* Attachment Preview */}
            <AnimatePresence>
              {attachment && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-full mb-2 left-4 z-50"
                >
                  <div className="relative group">
                    <img src={attachment.url} alt="Preview" className="w-24 h-24 object-cover rounded-xl border-2 border-indigo-500 shadow-xl bg-black" />
                    <button
                      onClick={() => setAttachment(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setHandsFreeMode(!handsFreeMode)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all mb-0.5 shrink-0 ${handsFreeMode ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse" : "text-gray-400 hover:text-white"}`}
              title="Hands-Free Mode"
            >
              <Headphones size={20} />
            </button>

            <button
              onClick={toggleListening}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all mb-0.5 shrink-0 ${isListening ? "bg-red-500/20 text-red-400 border border-red-500/50" : "text-gray-400 hover:text-white"}`}
            >
              {isListening ? <AudioVisualizer isListening={true} /> : <Mic size={20} />}
            </button>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-all mb-0.5 shrink-0 active:scale-90"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
