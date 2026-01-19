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
import { HistoryManager, ChatSession } from "./lib/history"; // New Import

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
  { id: "openai", name: "Draco V0.2", icon: "🐲", description: "Primary Advanced Model" },
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
  const [currentModel, setCurrentModel] = useState("openai");
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    window.speechSynthesis.cancel(); // Stop speaking if user interrupts
    setSpeakingMsgId(null);

    const originalInput = input.trim();
    // For UI display, if there's an attachment, append it as markdown image
    const uiContent = attachment ? `${originalInput}\n\n![${attachment.name}](${attachment.url})` : originalInput;

    const userMsg: Message = { role: "user", content: uiContent, timestamp: new Date().toISOString() };

    // Update State
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Update Session Title if first message
    if (messages.length === 0 && activeSessionId) {
      HistoryManager.updateTitle(activeSessionId, originalInput);
    }

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
        setMessages(prev => [...prev, { role: "assistant", content: "To forget something, please use the 'The Vault' section in the sidebar.", timestamp: new Date().toISOString() }]);
        setIsLoading(false);
        return;
      }



      // 1.7. Check for Web Fetch Command
      if (originalInput.startsWith("/webfetch ")) {
        const url = originalInput.replace("/webfetch ", "").replace(/['"]+/g, '').trim();
        if (!url) {
          setMessages(prev => [...prev, { role: "assistant", content: "Please provide a URL. Example: `/webfetch https://example.com/article`", timestamp: new Date().toISOString() }]);
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch("/api/webfetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Fetch failed");
          }

          let resultText = `📄 **Fetched Content from ${url}**\n\n`;
          resultText += data.content;

          if (data.truncated) {
            resultText += `\n\n*Note: Content was truncated from ${data.originalLength} to ${data.finalLength} characters for optimal processing.*`;
          }

          setMessages(prev => [...prev, { role: "assistant", content: resultText, timestamp: new Date().toISOString() }]);
        } catch (error) {
          setMessages(prev => [...prev, { role: "assistant", content: `❌ Fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`, timestamp: new Date().toISOString() }]);
        }
        setIsLoading(false);
        return;
      }





      // 1.9. Check for Generic API Request Command
      if (originalInput.startsWith("/request ")) {
        const params = originalInput.replace("/request ", "").trim();
        const parts = params.split(/\s+/);
        const method = parts[0]?.toUpperCase();
        const url = parts[1];

        if (!method || !url) {
          setMessages(prev => [...prev, { role: "assistant", content: "Invalid format. Usage: `/request <METHOD> <URL> [BODY_JSON] [HEADERS_JSON]`", timestamp: new Date().toISOString() }]);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        // Extract optional Body and Headers
        const restOfString = params.substring(method.length + 1 + url.length + 1).trim();
        let body = null;
        let headers = null;

        if (restOfString) {
          try {
            // Matching logic as in post-stream handler
            const firstBracket = restOfString.indexOf('{');
            if (firstBracket !== -1) {
              let openCount = 0;
              let closeIndex = -1;
              for (let i = firstBracket; i < restOfString.length; i++) {
                if (restOfString[i] === '{') openCount++;
                if (restOfString[i] === '}') openCount--;
                if (openCount === 0) {
                  closeIndex = i;
                  break;
                }
              }
              if (closeIndex !== -1) {
                const bodyString = restOfString.substring(firstBracket, closeIndex + 1);
                try { body = JSON.parse(bodyString); } catch (e) { body = bodyString; }

                const headerString = restOfString.substring(closeIndex + 1).trim();
                if (headerString && headerString.startsWith('{')) {
                  try { headers = JSON.parse(headerString); } catch (e) { }
                }
              } else {
                try { body = JSON.parse(restOfString); } catch (e) { body = restOfString; }
              }
            } else {
              body = restOfString;
            }
          } catch (e) {
            console.error("Error parsing request params", e);
          }
        }

        try {
          const response = await fetch("/api/proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method, url, body, headers })
          });

          const data = await response.json();

          let output = `📡 **API Request: ${method} ${url}**\n\n`;
          output += `**Status:** ${data.status} ${data.statusText}\n`;

          const responseStr = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
          output += `**Response:**\n\`\`\`json\n${responseStr}\n\`\`\``;

          setMessages(prev => [...prev, { role: "assistant", content: output, timestamp: new Date().toISOString() }]);
        } catch (error) {
          setMessages(prev => [...prev, { role: "assistant", content: `❌ Request failed: ${error instanceof Error ? error.message : "Unknown error"}`, timestamp: new Date().toISOString() }]);
        }
        setIsLoading(false);
        return;
      }


      // 2. Determine Model & System Prompt
      let activeModel = currentModel;

      // 3. Streaming Request
      const vaultContext = memory.length > 0 ? `\n\n[THE VAULT - LONG TERM MEMORY]:\n${memory.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\n[INSTRUCTION]: Use the above memory to personalize your response if relevant.` : "";
      const finalSystemPrompt = settings.systemPrompt + vaultContext;

      const messagesPayload = [
        { role: "system", content: finalSystemPrompt },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      // Add current message. If attachment, format as multimodal.
      if (attachment) {
        messagesPayload.pop(); // Remove the last text-only message we just added to state (or handled differently)
        // Wait, 'newMessages' has the last message. 'messagesPayload' is constructed from it.
        // But for API payload we need multimodal object format if attachment.

        // Let's reconstruction last item in payload
        const lastPayloadItem = messagesPayload[messagesPayload.length - 1];
        messagesPayload[messagesPayload.length - 1] = {
          role: "user",
          content: [
            { type: "text", text: originalInput },
            { type: "image_url", image_url: { url: attachment.url } }
          ]
        } as any;
      }

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

      // Check if response is JSON (legacy/fallback) or Stream
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        let content = data.response;
        if (typeof content === 'object') content = JSON.stringify(content);

        // Image Check (for legacy path)
        if (content.trim().startsWith("/image") || content.trim().startsWith("/draw")) {
          const prompt = content.replace(/^\/(image|draw)\s*/i, "").trim();
          const encodedPrompt = encodeURIComponent(prompt);
          const randomSeed = Math.floor(Math.random() * 10000);
          const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=768&nologo=true`;
          content = `Generated image for "**${prompt}**":\n\n![Generated Image](${imageUrl})`;
        }

        setMessages(prev => [...prev, {
          role: "assistant",
          content: content,
          timestamp: new Date().toISOString(),
          thought: data.cached ? "⚡ Cached Response" : undefined,
          isThinking: false
        }]);
      } else {
        // Handle Streaming Response
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        // Add initial empty assistant message
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          isThinking: false
        }]);

        const decoder = new TextDecoder();
        let done = false;
        let streamedContent = "";
        let streamedThought = "";
        let buffer = ""; // Buffer for handling split chunks

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value, { stream: true });
          buffer += chunkValue;

          // Process buffer line by line
          const lines = buffer.split('\n');
          // Keep the last line in buffer as it might be incomplete
          buffer = lines.pop() || "";

          let hasNewContent = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") continue;

              try {
                const json = JSON.parse(dataStr);
                // Extract content from OpenAI-style chunk
                const contentChunk = json.choices?.[0]?.delta?.content;
                // Optional: usage of reasoning_content if available (e.g. DeepSeek)
                const reasoningChunk = json.choices?.[0]?.delta?.reasoning_content;

                if (contentChunk) {
                  streamedContent += contentChunk;
                  hasNewContent = true;
                }

                if (reasoningChunk) {
                  streamedThought += reasoningChunk;
                  hasNewContent = true;
                }
              } catch (e) {
                // If parse fails, ignore (it might be a keepalive or garbage)
                // console.warn("Failed to parse SSE JSON", e);
              }
            } else {
              // Non-SSE line? 
              // If we are strictly in SSE mode, we ignore. 
              // If the provider sends raw text mixed in (unlikely for Pollinations), we might lose it.
              // But given the logs, it IS SSE. So stricter parsing is better to avoid "data: ..." text.
            }
          }

          if (hasNewContent) {
            setMessages(prev => {
              const newArr = [...prev];
              const lastMsg = newArr[newArr.length - 1];
              lastMsg.content = streamedContent;
              if (streamedThought) {
                lastMsg.thought = streamedThought;
                lastMsg.isThinking = !streamedContent; // If we have thought but no content yet, we are "thinking"
              }
              return newArr;
            });
          }
        }

        // Post-Stream Image Check
        if (streamedContent.trim().startsWith("/image") || streamedContent.trim().startsWith("/draw")) {
          const prompt = streamedContent.replace(/^\/(image|draw)\s*/i, "").trim();
          const encodedPrompt = encodeURIComponent(prompt);
          const randomSeed = Math.floor(Math.random() * 10000);
          const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=768&nologo=true`;
          streamedContent = `Generated image for "**${prompt}**":\n\n![Generated Image](${imageUrl})`;

          setMessages(prev => {
            const newArr = [...prev];
            newArr[newArr.length - 1].content = streamedContent;
            return newArr;
          });
        }



        // Post-Stream Web Fetch Check
        if (streamedContent.trim().startsWith("/webfetch ")) {
          // Take first line and remove quotes
          const url = streamedContent.replace(/^\/webfetch\s+/i, "").split('\n')[0].replace(/['"]+/g, '').trim();
          if (url) {
            setIsLoading(true);
            try {
              const response = await fetch("/api/webfetch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
              });

              const data = await response.json();

              if (response.ok) {
                let resultText = `📄 **Fetched Content from ${url}**\n\n`;
                resultText += data.content;

                if (data.truncated) {
                  resultText += `\n\n*Note: Content was truncated from ${data.originalLength} to ${data.finalLength} characters.*`;
                }

                setMessages(prev => {
                  const newArr = [...prev];
                  newArr[newArr.length - 1].content = resultText;
                  return newArr;
                });
              }
            } catch (error) {
              setMessages(prev => {
                const newArr = [...prev];
                newArr[newArr.length - 1].content = `❌ Fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`;
                return newArr;
              });
            }
            setIsLoading(false);
          }
        }



        // Post-Stream Generic API Request Check
        if (streamedContent.trim().startsWith("/request ")) {
          const params = streamedContent.replace(/^\/request\s+/i, "").trim();
          // regex to split by space but keep json objects together is tricky
          // Simpler approach: split by first 3 spaces to get Method, URL, Body, Headers
          // But strict parsing is better:
          // Expected format: /request METHOD URL [BODY_JSON] [HEADERS_JSON]

          const parts = params.split(/\s+/);
          const method = parts[0]?.toUpperCase();
          const url = parts[1];

          if (method && url) {
            setIsLoading(true);

            // Extract optional Body and Headers
            // We need to parse the rest of the string which might contain JSON with spaces
            const restOfString = params.substring(method.length + 1 + url.length + 1).trim();

            let body = null;
            let headers = null;

            if (restOfString) {
              try {
                // Try to split into two JSON objects if possible
                // This is a naive parser for the chat command format
                const firstBracket = restOfString.indexOf('{');
                if (firstBracket !== -1) {
                  // Assume the first JSON blob is the body
                  // We need to find the matching closing bracket
                  let openCount = 0;
                  let closeIndex = -1;

                  for (let i = firstBracket; i < restOfString.length; i++) {
                    if (restOfString[i] === '{') openCount++;
                    if (restOfString[i] === '}') openCount--;
                    if (openCount === 0) {
                      closeIndex = i;
                      break;
                    }
                  }

                  if (closeIndex !== -1) {
                    const bodyString = restOfString.substring(firstBracket, closeIndex + 1);
                    try { body = JSON.parse(bodyString); } catch (e) { console.error("Bad JSON body", e); body = bodyString; }

                    const headerString = restOfString.substring(closeIndex + 1).trim();
                    if (headerString && headerString.startsWith('{')) {
                      try { headers = JSON.parse(headerString); } catch (e) { console.error("Bad JSON headers", e); }
                    }
                  } else {
                    // Just treat whole thing as body
                    try { body = JSON.parse(restOfString); } catch (e) { body = restOfString; }
                  }
                } else {
                  // No JSON, maybe just string body
                  body = restOfString;
                }
              } catch (e) {
                console.error("Error parsing request params", e);
              }
            }

            try {
              const response = await fetch("/api/proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method, url, body, headers })
              });

              const data = await response.json();

              let output = `📡 **API Request: ${method} ${url}**\n\n`;
              output += `**Status:** ${data.status} ${data.statusText}\n`;

              const responseStr = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
              output += `**Response:**\n\`\`\`json\n${responseStr}\n\`\`\``;

              setMessages(prev => {
                const newArr = [...prev];
                newArr[newArr.length - 1].content = output;
                return newArr;
              });
            } catch (error) {
              setMessages(prev => {
                const newArr = [...prev];
                newArr[newArr.length - 1].content = `❌ Request failed: ${error instanceof Error ? error.message : "Unknown error"}`;
                return newArr;
              });
            }
            setIsLoading(false);
          }
        }
      }
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
                    <div className="text-7xl mb-2 animate-pulse cursor-default drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.5)]">🐉</div>
                    <div className="absolute inset-0 bg-[var(--color-primary)]/30 rounded-full blur-2xl animate-pulse delay-75 pointer-events-none"></div>
                  </motion.div>

                  <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-[var(--color-primary)] via-white to-[var(--color-secondary)] bg-clip-text text-transparent mb-4 bg-[length:200%_auto] animate-gradient tracking-tight drop-shadow-sm">
                    Draco V0.2
                  </h1>
                  <p className="text-[var(--color-secondary)] max-w-lg text-lg leading-relaxed mb-12 font-normal opacity-90">
                    Agentic Intelligence with <span className="text-[var(--color-primary)] font-semibold border-b border-[var(--color-primary)]/30">Real-World Connections</span>
                  </p>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
                    {/* Card 1: Web Search */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      whileHover={{ scale: 1.05, translateY: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setInput("Search for ")}
                      className="flex flex-col items-center p-6 bg-[var(--input-bg)]/40 backdrop-blur-md border border-[var(--border-color)] hover:border-blue-500/50 rounded-2xl transition-all shadow-xl hover:shadow-blue-500/20 group"
                    >
                      <div className="p-4 rounded-full bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors ring-1 ring-blue-500/20">
                        <Globe className="w-8 h-8 text-blue-400 group-hover:rotate-12 transition-transform" />
                      </div>
                      <h3 className="text-white font-bold mb-1">Web Search</h3>
                      <p className="text-xs text-gray-400">Live internet access</p>
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
                      className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center shrink-0 border border-[var(--color-primary)]/30 mt-1 shadow-lg shadow-[var(--color-primary)]/10">
                            <Bot size={16} className="text-[var(--color-primary)]" />
                          </div>
                        </div>
                      )}

                      <div className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-3 md:px-5 md:py-4 text-sm md:text-base leading-relaxed backdrop-blur-sm transition-all duration-300 ${msg.role === "user"
                        ? "bg-[image:var(--message-user-bg)] text-white rounded-br-sm shadow-lg shadow-[var(--color-primary)]/20"
                        : "bg-[var(--message-ai-bg)]/90 border border-[var(--border-color)] text-[var(--foreground)] rounded-bl-sm shadow-xl shadow-[var(--color-primary)]/10 hover:shadow-[var(--color-primary)]/20"
                        }`}>

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

                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 mt-1">
                          <User size={16} className="text-white" />
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
                Draco V0.2 • Powered by Pollinations & SimplifAI-1
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
