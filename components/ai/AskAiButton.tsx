"use client";

import { Sparkles } from "lucide-react";
import { useAiContextStore } from "@/store/aiContextStore";
import { cn } from "@/lib/utils";

interface Props {
  question: string;
  label?: string;
  className?: string;
  variant?: "icon" | "chip";
}

export function AskAiButton({ question, label, className, variant = "icon" }: Props) {
  const setPendingQuestion = useAiContextStore((s) => s.setPendingQuestion);

  if (variant === "chip") {
    return (
      <button
        onClick={() => setPendingQuestion(question)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          "bg-violet-50 text-violet-700 border border-violet-200",
          "hover:bg-violet-100 transition",
          className
        )}
      >
        <Sparkles className="w-3 h-3" />
        {label ?? "Ask AI"}
      </button>
    );
  }

  return (
    <button
      onClick={() => setPendingQuestion(question)}
      title={label ?? "Ask AI about this"}
      className={cn(
        "p-1 rounded-md text-violet-400 hover:text-violet-600 hover:bg-violet-50 transition",
        className
      )}
    >
      <Sparkles className="w-3.5 h-3.5" />
    </button>
  );
}
