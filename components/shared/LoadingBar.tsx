"use client";

import { useEffect, useState } from "react";

export function LoadingBar({ progress }: { progress?: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (progress !== undefined) {
      setWidth(progress);
    } else {
      // Indeterminate: animate
      const interval = setInterval(() => {
        setWidth((w) => (w >= 90 ? 90 : w + 5));
      }, 200);
      return () => clearInterval(interval);
    }
  }, [progress]);

  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-brand rounded-full transition-all duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export function AnalysisLoader({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{progress}% complete</p>
      </div>
      <div className="w-64">
        <LoadingBar progress={progress} />
      </div>
    </div>
  );
}
