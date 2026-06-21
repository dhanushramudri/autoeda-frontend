"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTour } from "@/hooks/useTourContext";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TourOverlay: React.FC = () => {
  const { isOpen, currentStep, currentStepIndex, steps, nextStep, prevStep, endTour } = useTour();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const updateRect = useCallback(() => {
    if (!currentStep || currentStep.position === "center") {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(currentStep.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen, updateRect]);

  if (!isOpen || !currentStep) return null;

  const PAD = 8;
  const isCenter = currentStep.position === "center" || !targetRect;

  // Polygon clip-path cuts a transparent hole around the target element
  const spotlightClip = targetRect
    ? `polygon(
        0% 0%, 0% 100%,
        ${targetRect.left - PAD}px 100%,
        ${targetRect.left - PAD}px ${targetRect.top - PAD}px,
        ${targetRect.left + targetRect.width + PAD}px ${targetRect.top - PAD}px,
        ${targetRect.left + targetRect.width + PAD}px ${targetRect.top + targetRect.height + PAD}px,
        ${targetRect.left - PAD}px ${targetRect.top + targetRect.height + PAD}px,
        ${targetRect.left - PAD}px 100%,
        100% 100%, 100% 0%
      )`
    : undefined;

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[9998] bg-black/70 pointer-events-auto transition-[clip-path] duration-500 ease-in-out"
        style={spotlightClip ? { clipPath: spotlightClip } : undefined}
        onClick={endTour}
      />

      {/* Glow ring around the highlighted element */}
      {targetRect && (
        <div
          className="fixed z-[9999] rounded-lg pointer-events-none transition-all duration-500 ease-in-out"
          style={{
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
            boxShadow: "0 0 0 2px hsl(var(--primary)), 0 0 24px hsl(var(--primary) / 0.45)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[10000] bg-white rounded-xl shadow-2xl p-5 w-80 pointer-events-auto border border-gray-100 transition-all duration-500 ease-in-out"
        style={getTooltipStyle(targetRect, currentStep.position, isCenter)}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900 pr-6 leading-tight">
            {currentStep.title}
          </h3>
          <button
            onClick={endTour}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 -mt-0.5"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {currentStep.description}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5 items-center">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-full transition-all duration-300",
                  idx === currentStepIndex
                    ? "bg-primary w-5 h-1.5"
                    : "bg-gray-300 w-1.5 h-1.5"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {currentStepIndex + 1} / {steps.length}
          </span>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={endTour}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mr-auto"
          >
            Skip
          </button>
          {currentStepIndex > 0 && (
            <button
              onClick={prevStep}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          )}
          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={nextStep}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity"
            >
              Next
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={endTour}
              className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </>
  );
};

function getTooltipStyle(
  rect: TargetRect | null,
  position: string | undefined,
  isCenter: boolean
): React.CSSProperties {
  if (isCenter || !rect || typeof window === "undefined") {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const PAD = 16;
  const TW = 320;
  const TH = 230;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const clampX = (x: number) => Math.max(PAD, Math.min(x, vw - TW - PAD));
  const clampY = (y: number) => Math.max(PAD, Math.min(y, vh - TH - PAD));
  const cx = clampX(rect.left + rect.width / 2 - TW / 2);

  switch (position) {
    case "top":
      return { top: clampY(rect.top - TH - PAD), left: cx };
    case "left":
      return { top: clampY(rect.top + rect.height / 2 - TH / 2), left: clampX(rect.left - TW - PAD) };
    case "right":
      return { top: clampY(rect.top + rect.height / 2 - TH / 2), left: clampX(rect.left + rect.width + PAD) };
    default:
      return { top: clampY(rect.top + rect.height + PAD), left: cx };
  }
}
