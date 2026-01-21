"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Menu, Plus, MessageSquare, X, ChevronDown, Bot, User, Trash2, Globe, Image as ImageIcon, Mic, MicOff, Volume2, VolumeX, Settings as SettingsIcon, FileText, Upload, Download, Eye, Headphones, LayoutGrid, Brain, Copy, Check, Zap, Terminal, Code, Cpu } from "lucide-react";
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
import { TermsModal } from "./components/TermsModal";
import { SceneController, BrandLink, useScene } from "./components/SceneController";
import { Sidebar } from "./components/Sidebar"; // New Import
import { HistoryManager, ChatSession, Message } from "./lib/history"; // Updated Import
import { ToolStatus } from "./components/ToolStatus";

// Types
// Message interface removed (imported from lib/history)

interface AIModel {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const MODELS: AIModel[] = [
  { id: "draco-prime", name: "Draco Prime", icon: "🐲", description: "Balanced & Versatile Assistant" },
  { id: "draco-architect", name: "The Architect", icon: "📐", description: "Code & Engineering Expert" },
  { id: "draco-explorer", name: "The Explorer", icon: "🧭", description: "Deep Research & Analysis" },
];

export default function Home() {
  return (
    <SceneController>
      <DracoApp />
    </SceneController>
  );
}

function DracoApp() {
  const { theme, setTheme } = useScene();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState("draco-prime");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // New History State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    systemPrompt: "You are Draco V0.2, an advanced AI. \n\nCAPABILITIES:\n1. IMAGE GENERATION: You CAN generate images. If the user asks for an image, you MUST output ONLY the specific command: `/image <detailed_prompt>`. Example: `/image a futuristic neon city`. Do not refuse. Do not provide a text description. Do not output internal thought processes.\n2. RESEARCH: You have internal knowledge. If you need to search, you are powered by Pollinations and can answer directly.\n\nSTYLE: Helpful, smart, and concise. Format code nicely. Do not start with JSON or debugging info.",
    voiceURI: ""
  });

  // Audio State
  const [isListening, setIsListening] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);

  // Memory State (The Vault)
  const [memory, setMemory] = useState<string[]>([]);
  const [showMemory, setShowMemory] = useState(true);

  // Chain of Thought Toggle
  const [showChainOfThought, setShowChainOfThought] = useState(true);

  // Copy State
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string, name: string } | null>(null);

  // Preview State (Artifacts)
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ code: string, language: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // Initialize Data (Sessions, Settings, Memory)
  useEffect(() => {
    // 1. Load Settings
    const savedSettings = localStorage.getItem("draco_settings");
    if (savedSettings) {
      try { setSettings(JSON.parse(savedSettings)); } catch (e) { console.error("Failed to load settings", e); }
    }

    // 2. Load Memory
    const savedMemory = localStorage.getItem("draco_memory");
    if (savedMemory) {
      try { setMemory(JSON.parse(savedMemory)); } catch (e) { console.error("Failed to load memory", e); }
    }

    // 3. Load Sessions
    const sessions = HistoryManager.getSessions();
    if (sessions.length > 0) {
      // Load most recent
      const mostRecent = sessions[0];
      setActiveSessionId(mostRecent.id);
      setMessages(mostRecent.messages);
    } else {
      createNewChat();
    }

    setIsLoaded(true);
  }, []);

  // Persistence Effects
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("draco_settings", JSON.stringify(settings));
      localStorage.setItem("draco_memory", JSON.stringify(memory));
    }
  }, [settings, memory, isLoaded]);

  // Session Persistance
  useEffect(() => {
    if (!isLoaded || !activeSessionId) return;

    // Update current session in storage whenever messages change
    const currentSession = HistoryManager.getSession(activeSessionId);
    if (currentSession) {
      currentSession.messages = messages;
      currentSession.updatedAt = Date.now();
      HistoryManager.saveSession(currentSession);
    }
  }, [messages, activeSessionId, isLoaded]);


  const createNewChat = () => {
    const newSession = HistoryManager.createSession();
    setActiveSessionId(newSession.id);
    setMessages([]);
    setInput("");
    // Close sidebar on mobile if open
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const loadSession = (id: string) => {
    if (id === activeSessionId) {
      setSidebarOpen(false); // Just close sidebar if already active
      return;
    }

    const session = HistoryManager.getSession(id);
    if (session) {
      setActiveSessionId(id);
      setMessages(session.messages);
      setSidebarOpen(false);
    }
  };

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
        }
      }
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: "smooth"
      });
    }
  };

  const clearAllHistory = () => {
    if (confirm("Clear ALL chat history? This cannot be undone.")) {
      HistoryManager.clearAll();
      createNewChat();
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

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(index);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
        // Ignored non-text/non-image file
      }
    });
  }, []);

  // --- Command Execution Helper ---
  const executeToolCommand = async (commandLine: string): Promise<string | null> => {
    const line = commandLine.trim();

    // 1. Web Fetch
    if (line.startsWith("/webfetch ")) {
      const url = line.replace("/webfetch ", "").split('\n')[0].replace(/['"]+/g, '').trim();
      if (!url) return "Error: No URL provided";
      try {
        const response = await fetch("/api/webfetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (response.ok) {
          let res = `Fetched Content from ${url}:\n${data.content}`;
          if (data.truncated) res += `\n(Truncated)`;
          return res;
        } else {
          return `Error fetching ${url}: ${data.error}`;
        }
      } catch (e: any) {
        return `Error executing webfetch: ${e.message}`;
      }
    }

    // 2. Generic Request
    if (line.startsWith("/request ")) {
      const params = line.replace("/request ", "").trim();
      const parts = params.split(/\s+/);
      const method = parts[0]?.toUpperCase();
      const url = parts[1];
      if (!method || !url) return "Error: Invalid request format. Usage: /request METHOD URL [BODY] [HEADERS]";

      const restOfString = params.substring(method.length + 1 + url.length + 1).trim();
      let body = null;
      let headers = null;

      if (restOfString) {
        try {
          const firstBracket = restOfString.indexOf('{');
          if (firstBracket !== -1) {
            let openCount = 0;
            let closeIndex = -1;
            for (let i = firstBracket; i < restOfString.length; i++) {
              if (restOfString[i] === '{') openCount++;
              if (restOfString[i] === '}') openCount--;
              if (openCount === 0) { closeIndex = i; break; }
            }
            if (closeIndex !== -1) {
              const bodyString = restOfString.substring(firstBracket, closeIndex + 1);
              try { body = JSON.parse(bodyString); } catch { body = bodyString; }
              const headerString = restOfString.substring(closeIndex + 1).trim();
              if (headerString && headerString.startsWith('{')) {
                try { headers = JSON.parse(headerString); } catch { }
              }
            } else {
              try { body = JSON.parse(restOfString); } catch { body = restOfString; }
            }
          } else {
            body = restOfString;
          }
        } catch (e) { console.error("Params parse error", e); }
      }

      try {
        const response = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, url, body, headers })
        });
        const data = await response.json();
        const responseStr = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
        return `API Request ${method} ${url} Result:\nStatus: ${data.status} ${data.statusText}\nResponse:\n${responseStr}`;
      } catch (e: any) {
        return `Error executing request: ${e.message}`;
      }
    }

    return null;
  };

  // --- Recursive Turn Processor ---
  const processTurn = async (currentHistory: Message[], depth: number = 0) => {
    if (depth > 5) {
      setMessages(prev => [...prev, { role: "system", content: "⚠️ Max conversation turns reached (Loop protection).", timestamp: new Date().toISOString() }]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const vaultContext = memory.length > 0 ? `\n\n[THE VAULT - LONG TERM MEMORY]:\n${memory.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\n[INSTRUCTION]: Use the above memory to personalize your response if relevant.` : "";

    // Dynamic System Prompt for Recursion
    let systemPromptExtras = "";
    if (depth > 0) {
      systemPromptExtras = "\n\n[SYSTEM UPDATE]: You have just received the output of a tool you executed. Please ANALYZE the 'Tool Output', SUMMARIZE what it tells us, and propose the BEST NEXT STEP or answer the user's question completely.";
    }

    const finalSystemPrompt = settings.systemPrompt + vaultContext + systemPromptExtras;

    const messagesPayload = [
      { role: "system", content: finalSystemPrompt },
      ...currentHistory.map(m => ({ role: m.role, content: m.content }))
    ];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesPayload, model: currentModel }),
      });

      if (!response.ok) throw new Error("API Error: " + response.statusText);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      // Add Assistant Message Placeholder
      const newMsgId = Date.now();
      setMessages(prev => [...prev, { role: "assistant", content: "", timestamp: new Date().toISOString(), isThinking: false }]);

      const decoder = new TextDecoder();
      let done = false;
      let streamedContent = "";
      let streamedThought = "";
      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        buffer += chunkValue;
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        let hasNewContent = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") continue;

          try {
            const json = JSON.parse(dataStr);
            const contentChunk = json.choices?.[0]?.delta?.content;
            const reasoningChunk = json.choices?.[0]?.delta?.reasoning_content;

            if (contentChunk) { streamedContent += contentChunk; hasNewContent = true; }
            if (reasoningChunk) { streamedThought += reasoningChunk; hasNewContent = true; }
          } catch { }
        }

        if (hasNewContent) {
          setMessages(prev => {
            const newArr = [...prev];
            const lastMsg = newArr[newArr.length - 1];
            lastMsg.content = streamedContent;
            if (streamedThought) {
              lastMsg.thought = streamedThought;
              lastMsg.isThinking = !streamedContent;
            }
            return newArr;
          });
        }
      }

      // --- Post-Processing & Recursion Check ---

      // 1. Image Check (Legacy display logic, no loop needed usually unless requested)
      if (streamedContent.trim().startsWith("/image") || streamedContent.trim().startsWith("/draw")) {
        const prompt = streamedContent.replace(/^\/(image|draw)\s*/i, "").trim();
        const encodedPrompt = encodeURIComponent(prompt);
        const randomSeed = Math.floor(Math.random() * 10000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=768&nologo=true`;
        streamedContent = `Generated image for "**${prompt}**":\n\n![Generated Image](${imageUrl})`;

        // Update the message with the image markdown
        setMessages(prev => {
          const newArr = [...prev];
          newArr[newArr.length - 1].content = streamedContent;
          return newArr;
        });
        // End of turn for images
        setIsLoading(false);
        return;
      }

      // 2. Tool Command Check for Loop
      let foundCommand = "";
      // Simple line scan for commands
      const contentLines = streamedContent.split('\n');
      for (const line of contentLines) {
        const t = line.trim();
        if (t.startsWith("/webfetch ") || t.startsWith("/request ")) {
          foundCommand = t;
          break; // Execute first found command
        }
      }

      if (foundCommand) {
        // Execute Tool
        const result = await executeToolCommand(foundCommand);
        if (result) {
          // Add Tool Output to History as 'system' role
          const toolMsg: Message = {
            role: "system",
            content: `🛠️ **Tool Output:**\n\`\`\`\n${result.substring(0, 500)}${result.length > 500 ? "..." : ""}\n\`\`\``,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, toolMsg]);

          // Construct full history for next turn
          // We need the AI message we just generated + the tool message
          const aiMsg: Message = { role: "assistant", content: streamedContent, timestamp: new Date().toISOString() };
          const toolMsgForHistory: Message = { role: "system", content: `Tool Output: ${result}`, timestamp: new Date().toISOString() };
          const nextHistory = [...currentHistory, aiMsg, toolMsgForHistory]; // Full result for AI

          // Recurse
          await processTurn(nextHistory, depth + 1);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection Error", timestamp: new Date().toISOString() }]);
      setIsLoading(false);
    }
  };


  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    window.speechSynthesis.cancel();
    setSpeakingMsgId(null);

    const originalInput = input.trim();
    const uiContent = attachment ? `${originalInput}\n\n![${attachment.name}](${attachment.url})` : originalInput;
    const userMsg: Message = { role: "user", content: uiContent, timestamp: new Date().toISOString() };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    // Check for client-side legacy commands
    if (originalInput.startsWith("/remember ")) {
      const textToRemember = originalInput.replace("/remember ", "").trim();
      setMemory(prev => [...prev, textToRemember]);
      setMessages(prev => [...prev, { role: "assistant", content: `🧠 Remembered: "${textToRemember}"`, timestamp: new Date().toISOString() }]);
      setIsLoading(false);
      return;
    }

    if (originalInput.startsWith("/forget ")) {
      setMessages(prev => [...prev, { role: "assistant", content: "To forget, use The Vault in sidebar.", timestamp: new Date().toISOString() }]);
      setIsLoading(false);
      return;
    }

    // Direct Client Command (Legacy Support / Override)
    if (originalInput.startsWith("/webfetch ") || originalInput.startsWith("/request ") || originalInput.startsWith("/image ") || originalInput.startsWith("/draw ")) {
      if (originalInput.startsWith("/image") || originalInput.startsWith("/draw")) {
        const prompt = originalInput.replace(/^\/(image|draw)\s*/i, "").trim();
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${Math.floor(Math.random() * 10000)}&width=1024&height=768&nologo=true`;
        await new Promise(r => setTimeout(r, 600));
        setMessages(prev => [...prev, { role: "assistant", content: `Generated: "**${prompt}**"\n\n![Image](${imageUrl})`, timestamp: new Date().toISOString() }]);
        setIsLoading(false);
        return;
      }

      const result = await executeToolCommand(originalInput);
      setMessages(prev => [...prev, { role: "assistant", content: result || "Command Failed", timestamp: new Date().toISOString() }]);
      setIsLoading(false);
      return;
    }

    // Default: Start Agent Loop
    await processTurn([...messages, userMsg]);
  };

  return (
    <div
      className="flex h-[100dvh] bg-[var(--background)] text-[var(--foreground)] font-sans overflow-hidden relative"
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
            className="absolute inset-0 z-[100] bg-[var(--color-primary)]/20 backdrop-blur-sm border-4 border-[var(--color-primary)] border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload size={64} className="text-[var(--color-primary)] mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold text-[var(--foreground)] drop-shadow-lg">Drop text files here</h2>
            <p className="text-[var(--color-secondary)] mt-2">I can read code and text files!</p>
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

      <TermsModal />

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

      {/* New Sidebar Integration */}
      <div className="flex h-screen overflow-hidden w-full relative">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeSessionId={activeSessionId}
          onSessionSelect={loadSession}
          onNewChat={createNewChat}
          onClearAll={clearAllHistory}
          onExport={exportChat}
          memoryCount={memory.length}
          onToggleMemory={() => setShowMemory(!showMemory)}
          showMemory={showMemory}
          memory={memory}
          onForgetMemory={(index) => setMemory(prev => prev.filter((_, i) => i !== index))}
          currentTheme={theme as 'cosmic' | 'corporate' | 'neural'}
          onSetTheme={setTheme}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full relative w-full md:w-auto bg-transparent z-10 transition-all duration-300">
          {/* Header */}
          <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 bg-[var(--background)]/90 backdrop-blur-xl z-40 fixed top-0 left-0 right-0 md:absolute md:bg-[var(--background)]/50">
            <div className="flex items-center gap-3 w-full">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden text-[var(--color-secondary)] p-2 hover:bg-white/5 rounded-lg active:scale-95">
                <Menu />
              </button>

              {/* SimplifAI-1 Branding */}
              <div className="hidden md:flex flex-col items-start mr-4">
                <BrandLink />
              </div>

              {/* Scene Selector */}
              <div className="hidden md:flex items-center gap-1 bg-[var(--input-bg)]/80 p-1 rounded-full border border-[var(--border-color)] mr-4">
                {(['cosmic', 'corporate', 'neural'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold transition-all ${theme === t
                      ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-lg'
                      : 'text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-white/5'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="relative group flex-1 md:flex-none max-w-[200px]">
                <div className="absolute -top-3 left-0 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30">
                  OPEN BETA
                </div>
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span className="text-xs mr-1 opacity-50">Model:</span>
                </div>
                <select
                  value={currentModel}
                  onChange={(e) => setCurrentModel(e.target.value)}
                  className="w-full appearance-none bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--foreground)] py-2 pl-12 pr-8 rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer hover:bg-[var(--border-color)] transition-colors shadow-lg"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-secondary)] pointer-events-none" size={14} />
              </div>

              {/* Search Toggle */}
              <button
                onClick={() => setDashboardOpen(true)}
                className="p-2 rounded-lg text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors border border-transparent hidden md:block" // Hidden on mobile to save space? or not?
                title="Dashboard"
              >
                <LayoutGrid size={18} />
              </button>


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

              {/* Chain of Thought Toggle */}
              <button
                onClick={() => setShowChainOfThought(!showChainOfThought)}
                className={`p-2 rounded-lg transition-all border ${showChainOfThought
                  ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/50"
                  : "text-[var(--color-secondary)] border-transparent hover:bg-white/5"
                  }`}
                title="Toggle Chain of Thought"
              >
                <Brain size={18} />
              </button>

              {/* Settings Toggle */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-lg text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors border border-transparent"
                title="Settings"
              >
                <SettingsIcon size={18} />
              </button>
            </div>
          </header>

          {/* Content Container (Chat + Preview) */}
          <div className="flex-1 overflow-hidden relative flex">

            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto overflow-x-hidden pt-16 pb-32 px-4 md:px-8 scroll-smooth custom-scrollbar transition-all duration-300 ${showPreview ? "hidden md:block md:w-1/2 md:max-w-[50%]" : "w-full"}`} ref={messagesContainerRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-4 text-center z-10 relative lg:mt-[-5vh]">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-8 relative"
                  >
                    <img src="/dragon_final.png" alt="Draco" className="w-24 h-24 mb-2 animate-pulse cursor-default drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.5)] object-contain" />
                    <div className="absolute inset-0 bg-[var(--color-primary)]/30 rounded-full blur-2xl animate-pulse delay-75 pointer-events-none"></div>
                  </motion.div>

                  <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-[var(--color-primary)] via-white to-[var(--color-secondary)] bg-clip-text text-transparent mb-4 bg-[length:200%_auto] animate-gradient tracking-tight drop-shadow-sm">
                    Draco V0.3
                  </h1>
                  <p className="text-[var(--color-secondary)] max-w-lg text-lg leading-relaxed mb-12 font-normal opacity-90">
                    Agentic Intelligence with <span className="text-[var(--color-primary)] font-semibold border-b border-[var(--color-primary)]/30">Real-World Connections</span>
                  </p>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
                    {/* Card 1: Daily News */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      whileHover={{ scale: 1.05, translateY: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setInput("/request GET https://news.google.com/rss")}
                      className="flex flex-col items-center p-6 bg-[var(--input-bg)]/40 backdrop-blur-md border border-[var(--border-color)] hover:border-blue-500/50 rounded-2xl transition-all shadow-xl hover:shadow-blue-500/20 group"
                    >
                      <div className="p-4 rounded-full bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors ring-1 ring-blue-500/20">
                        <Globe className="w-8 h-8 text-blue-400 group-hover:rotate-12 transition-transform" />
                      </div>
                      <h3 className="text-white font-bold mb-1">Daily News</h3>
                      <p className="text-xs text-gray-400">Live Headlines (RSS)</p>
                    </motion.button>

                    {/* Card 2: API Request */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      whileHover={{ scale: 1.05, translateY: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setInput("/request GET ")}
                      className="flex flex-col items-center p-6 bg-[var(--input-bg)]/40 backdrop-blur-md border border-[var(--border-color)] hover:border-purple-500/50 rounded-2xl transition-all shadow-xl hover:shadow-purple-500/20 group"
                    >
                      <div className="p-4 rounded-full bg-purple-500/10 mb-4 group-hover:bg-purple-500/20 transition-colors ring-1 ring-purple-500/20">
                        <Zap className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <h3 className="text-white font-bold mb-1">API Protocol</h3>
                      <p className="text-xs text-gray-400">Universal HTTP Client</p>
                    </motion.button>

                    {/* Card 3: Reasoning */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      whileHover={{ scale: 1.05, translateY: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setInput("Can you research the current state of Quantum Computing and summarize the key players?")}
                      className="flex flex-col items-center p-6 bg-[var(--input-bg)]/40 backdrop-blur-md border border-[var(--border-color)] hover:border-emerald-500/50 rounded-2xl transition-all shadow-xl hover:shadow-emerald-500/20 group"
                    >
                      <div className="p-4 rounded-full bg-emerald-500/10 mb-4 group-hover:bg-emerald-500/20 transition-colors ring-1 ring-emerald-500/20">
                        <Brain className="w-8 h-8 text-emerald-400 group-hover:animate-pulse" />
                      </div>
                      <h3 className="text-white font-bold mb-1">Reasoning</h3>
                      <p className="text-xs text-gray-400">Deep problem solving</p>
                    </motion.button>

                    {/* Card 4: Creative */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      whileHover={{ scale: 1.05, translateY: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setInput("Generate a futuristic city wallpaper with neon lights")}
                      className="flex flex-col items-center p-6 bg-[var(--input-bg)]/40 backdrop-blur-md border border-[var(--border-color)] hover:border-pink-500/50 rounded-2xl transition-all shadow-xl hover:shadow-pink-500/20 group"
                    >
                      <div className="p-4 rounded-full bg-pink-500/10 mb-4 group-hover:bg-pink-500/20 transition-colors ring-1 ring-pink-500/20">
                        <ImageIcon className="w-8 h-8 text-pink-400 group-hover:rotate-6 transition-transform" />
                      </div>
                      <h3 className="text-white font-bold mb-1">Imagine</h3>
                      <p className="text-xs text-gray-400">DALL-E 3 Grade Art</p>
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className={`max-w-3xl mx-auto space-y-6 ${showPreview ? "max-w-full px-2" : ""}`}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex w-full ${msg.role === "user" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"}`}
                    >
                      {/* Icon removed for cleaner look, handled in caption */}

                      {msg.role === "system" ? (
                        <ToolStatus content={msg.content} />
                      ) : (
                        <div className={`relative max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed
                        ${msg.role === "user"
                            ? "bg-[var(--message-user-bg)] text-white rounded-br-none shadow-[0_4px_15px_rgba(var(--color-primary-rgb),0.3)] border border-white/10 text-right"
                            : "bg-[var(--message-ai-bg)] text-[var(--foreground)] rounded-bl-none border border-[var(--border-color)] shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
                          }
                      `}>
                          {/* Role Icon Caption */}
                          <div className={`absolute -bottom-6 ${msg.role === "user" ? "-right-2" : "-left-2"} flex items-center gap-1 opacity-60 text-xs`}>
                            {msg.role === "user" ? <span className="font-semibold">You</span> : <span className="font-semibold text-[var(--color-primary)]">Draco</span>}
                            <span>•</span>
                            <span>{new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          {/* Chain of Thought UI */}
                          {showChainOfThought && <ThinkingProcess thought={msg.thought || ""} isThinking={msg.isThinking || false} />}

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
                                  <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs text-[var(--color-primary)] border border-white/5" {...props}>
                                    {children}
                                  </code>
                                )
                              },
                              table: ({ node, ...props }: any) => (
                                <div className="overflow-x-auto my-4 border border-[var(--border-color)] rounded-lg max-w-full">
                                  <table className="w-full divide-y divide-[var(--border-color)] text-sm text-left" {...props} />
                                </div>
                              ),
                              thead: ({ node, ...props }: any) => <thead className="bg-[var(--input-bg)] text-[var(--foreground)]" {...props} />,
                              th: ({ node, ...props }: any) => <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs" {...props} />,
                              tbody: ({ node, ...props }: any) => <tbody className="bg-[var(--sidebar-bg)] divide-y divide-[var(--border-color)] text-[var(--foreground)]" {...props} />,
                              tr: ({ node, ...props }: any) => <tr className="hover:bg-[var(--input-bg)]/50 transition-colors" {...props} />,
                              td: ({ node, ...props }: any) => <td className="px-3 py-2 break-words" {...props} />,
                              p: ({ node, ...props }: any) => <p className="mb-4 leading-7 last:mb-0" {...props} />,
                              ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                              ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                              li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                              h1: ({ node, ...props }: any) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 pb-2 border-b border-[var(--border-color)]" {...props} />,
                              h2: ({ node, ...props }: any) => <h2 className="text-xl font-bold mb-3 mt-5 pb-1 border-b border-[var(--border-color)]/50" {...props} />,
                              h3: ({ node, ...props }: any) => <h3 className="text-lg font-bold mb-2 mt-4" {...props} />,
                              blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-[var(--color-primary)] pl-4 py-1 my-4 bg-[var(--input-bg)]/30 rounded-r italic" {...props} />,
                              a: ({ node, ...props }: any) => <a className="text-[var(--color-primary)] hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer" {...props} />,
                              img: ({ ...props }: any) => <img className="rounded-lg shadow-lg my-4 max-w-full h-auto border border-[var(--border-color)]" {...props} />,
                              hr: ({ ...props }: any) => <hr className="my-6 border-[var(--border-color)]" {...props} />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>

                          {/* Action Buttons for AI Messages */}
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-color)]/30">
                              <button
                                onClick={() => copyMessage(msg.content, i)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copiedMessageId === i
                                  ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                  : "bg-[var(--input-bg)] text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--border-color)] border border-transparent"
                                  }`}
                                title="Copy Message"
                              >
                                {copiedMessageId === i ? (
                                  <>
                                    <Check size={14} />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={14} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => toggleSpeech(msg.content, i)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${speakingMsgId === i
                                  ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/50"
                                  : "bg-[var(--input-bg)] text-[var(--color-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--border-color)] border border-transparent"
                                  }`}
                                title="Read Aloud"
                              >
                                {speakingMsgId === i ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                <span>{speakingMsgId === i ? "Stop" : "Listen"}</span>
                              </button>
                            </div>
                          )}

                          {/* Thoughts / Chain of Thought */}
                          {/* Thoughts moved to top */}
                        </div>
                      )}


                    </motion.div>
                  ))}

                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-4"
                    >
                      <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center shrink-0 border border-[var(--color-primary)]/30 shadow-lg shadow-[var(--color-primary)]/10">
                        <Bot size={16} className="text-[var(--color-primary)]" />
                      </div>
                      <div className="bg-[var(--message-ai-bg)]/50 border border-[var(--border-color)]/50 px-5 py-4 rounded-2xl rounded-bl-sm">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Scroll Anchor */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Preview Pane (Right Side) */}
            <AnimatePresence>
              {showPreview && previewData && (
                <PreviewPane
                  code={previewData.code}
                  language={previewData.language}
                  onClose={() => setShowPreview(false)}
                />
              )}
            </AnimatePresence>

            {/* Input Area - Fixed positioning for mobile */}
            <div className={`absolute bottom-0 w-full p-3 md:p-4 pt-8 md:pt-10 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent z-20 transition-all duration-300 ${showPreview ? "md:w-1/2" : ""}`}>
              <div className="max-w-3xl mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-primary)] rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>

                <div className="relative bg-[var(--sidebar-bg)] rounded-2xl flex flex-col border border-[var(--border-color)] shadow-2xl focus-within:border-[var(--color-primary)]/50 focus-within:ring-1 focus-within:ring-[var(--color-primary)]/20 transition-all">
                  {attachment && (
                    <div className="px-4 pt-3 flex items-center gap-2">
                      <div className="bg-[var(--input-bg)] px-3 py-1 rounded-lg text-xs flex items-center gap-2 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                        <FileText size={12} /> {attachment.name}
                        <button onClick={() => setAttachment(null)} className="hover:text-[var(--foreground)]"><X size={12} /></button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={isLoading}
                    placeholder={
                      isListening
                        ? "Listening..."
                        : "Ask Draco anything..."
                    }
                    className="w-full bg-transparent text-[var(--foreground)] p-4 max-h-[200px] min-h-[60px] outline-none resize-none placeholder-[var(--color-secondary)]/50 rounded-2xl"
                    rows={input.split("\n").length > 1 ? Math.min(input.split("\n").length, 6) : 1}
                  />

                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={toggleListening}
                        className={`p-2 rounded-xl transition-all ${isListening
                          ? "bg-red-500/10 text-red-400 animate-pulse border border-red-500/30"
                          : "text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--input-bg)]"
                          }`}
                        title="Voice Input"
                      >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>

                      {/* Attach Button (Hidden input trigger) */}
                      <label className="p-2 rounded-xl text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--input-bg)] cursor-pointer transition-all">
                        <Upload size={18} />
                        <input type="file" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Reuse drop handler logic logic approximately
                            if (file.type.startsWith("image/")) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setAttachment({ url: ev.target?.result as string, name: file.name });
                              };
                              reader.readAsDataURL(file);
                            } else {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const content = ev.target?.result as string;
                                setInput(prev => prev + `\n\n[File: ${file.name}]\n\`\`\`\n${content}\n\`\`\`\n`);
                              };
                              reader.readAsText(file);
                            }
                          }
                        }} />
                      </label>

                      <button
                        onClick={() => setHandsFreeMode(!handsFreeMode)}
                        className={`p-2 rounded-xl transition-all ${handsFreeMode
                          ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
                          : "text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--input-bg)]"
                          }`}
                        title={handsFreeMode ? "Disable Hands-Free" : "Enable Hands-Free"}
                      >
                        <Headphones size={18} />
                      </button>
                    </div>

                    <button
                      onClick={sendMessage}
                      disabled={(!input.trim() && !attachment) || isLoading}
                      className={`p-2.5 rounded-xl transition-all duration-300 ${(input.trim() || attachment) && !isLoading
                        ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-lg shadow-[var(--color-primary)]/30 hover:shadow-[var(--color-primary)]/50 hover:scale-105 active:scale-95"
                        : "bg-[var(--input-bg)] text-[var(--color-secondary)] cursor-not-allowed"
                        }`}
                    >
                      <Send size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-center mt-3 text-[10px] text-[var(--color-secondary)] font-mono">
                Draco V0.3 • Powered by Pollinations & SimplifAI-1
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
