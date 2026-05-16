"use client";

import { useState, useRef, useEffect } from "react";
import { datasetsApi } from "@/lib/api";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  datasetId: string;
  datasetName?: string;
}

export function AskAiPanel({ datasetId, datasetName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: `Hi! I'm your AI analyst for **${datasetName || "this dataset"}**. Ask me anything about the data — quality issues, what to explore next, what the columns mean, or how to clean it.`,
        },
      ]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, datasetName, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await datasetsApi.aiChat(
        datasetId,
        text,
        [...messages, userMsg].slice(-12)
      );
      const reply: string = res.data?.reply ?? "No response.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the AI service. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg",
          "bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition",
          open && "hidden"
        )}
      >
        <MessageCircle className="w-4 h-4" />
        Ask AI
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[100] w-[380px] max-h-[560px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-semibold">Ask AI Analyst</span>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-violet-700 rounded p-0.5 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm min-h-0">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-2 max-w-full",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                    msg.role === "user" ? "bg-blue-100" : "bg-violet-100"
                  )}
                >
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-blue-600" />
                    : <Bot className="w-3.5 h-3.5 text-violet-600" />
                  }
                </div>
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                  <span className="text-xs text-gray-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2.5 flex gap-2 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about this dataset..."
              className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 min-w-0"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
