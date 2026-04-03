"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

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
  placeholder = "Tell Draco what to build, debug, or deploy...",
}: AgentInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "24px";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isProcessing) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "24px";
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

  const canSend = value.trim().length > 0 && !disabled && !isProcessing;

  return (
    <div className="shrink-0 w-full">
      <div className="max-w-[720px] mx-auto px-5 pb-5 pt-2">
        {/* Processing indicator */}
        <AnimatedProcessing visible={isProcessing} />

        {/* Input container */}
        <div className={`
          relative flex items-end gap-2
          px-4 py-3 rounded-2xl
          bg-[#111118]/90 border border-white/[0.08]
          hover:border-white/[0.12]
          focus-within:border-[#6c3bff]/30 focus-within:shadow-lg focus-within:shadow-[#6c3bff]/5
          transition-all duration-200
          ${isProcessing ? "border-[#6c3bff]/15" : ""}
        `}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isProcessing}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent text-[14px] text-white/90 placeholder:text-white/20 resize-none outline-none leading-relaxed min-h-[24px] max-h-[150px] disabled:cursor-not-allowed"
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200
              ${canSend
                ? "bg-[#6c3bff] hover:bg-[#7c4dff] text-white shadow-lg shadow-[#6c3bff]/25 scale-100"
                : "bg-white/[0.05] text-white/15 scale-90"
              }
            `}
          >
            {isProcessing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ArrowUp size={15} strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/12 mt-2.5 select-none">
          Draco Agent • Live Linux workspace • Commands execute in real-time
        </p>
      </div>
    </div>
  );
}

// Animated processing bar
function AnimatedProcessing({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-center pb-3">
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#6c3bff]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[#6c3bff]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[#6c3bff]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[11px] text-white/25 font-medium">Draco is working...</span>
      </div>
    </div>
  );
}
