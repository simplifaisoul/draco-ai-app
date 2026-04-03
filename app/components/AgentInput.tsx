"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";

interface AgentInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  placeholder?: string;
}

export default function AgentInput({
  onSend,
  disabled = false,
  isProcessing = false,
  placeholder = "Tell Draco what to build...",
}: AgentInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isProcessing) return;
    onSend(trimmed);
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, isProcessing, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className={`
        relative flex items-end gap-2
        px-4 py-3 rounded-2xl
        bg-white/[0.03] border border-white/[0.08]
        hover:border-white/[0.12] focus-within:border-purple-500/30 focus-within:bg-white/[0.04]
        transition-all shadow-lg shadow-black/20
        ${isProcessing ? "opacity-70" : ""}
      `}>
        {/* Sparkle indicator when processing */}
        {isProcessing && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d0d14] border border-purple-500/20 text-[10px] text-purple-400/80">
            <Loader2 size={10} className="animate-spin" />
            Draco is working...
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isProcessing}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/20 resize-none outline-none leading-relaxed min-h-[24px] max-h-[160px] disabled:cursor-not-allowed"
        />

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled || isProcessing}
          className={`
            shrink-0 p-2 rounded-xl transition-all
            ${value.trim() && !disabled && !isProcessing
              ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 scale-100"
              : "bg-white/[0.04] text-white/15 scale-95"
            }
          `}
        >
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
      <p className="text-center text-[10px] text-white/15 mt-2">
        Draco has a live Linux machine. Commands execute in real-time.
      </p>
    </div>
  );
}
