"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactWordcloud = dynamic(() => import("react-wordcloud"), {
  ssr: false,
}) as any;

interface WordCloudProps {
  words: Array<{ text: string; value: number }>;
  width?: number;
  height?: number;
}

export function WordCloud({
  words,
  width = 800,
  height = 400,
}: WordCloudProps) {
  const callbacks = useMemo(
    () => ({
      onWordClick: (word: any) => {
        console.log(`Clicked word: ${word.text}`);
      },
    }),
    []
  );

  const options = useMemo(
    () => ({
      colors: ["#3b82f6", "#1e40af", "#1e3a8a", "#60a5fa", "#93c5fd"],
      enableTooltip: true,
      deterministic: false,
      fontFamily: "impact",
      fontSizes: [12, 60],
      fontStyle: "normal",
      fontWeight: "bold",
      padding: 1,
      rotations: 3,
      rotationAngles: [0, 90],
      scale: "sqrt",
      spiral: "archimedean",
      transitionDuration: 1000,
    }),
    []
  );

  if (!words || words.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded border border-border bg-card">
        <p className="text-muted-foreground">No words to display</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded border border-border bg-card p-4">
      <ReactWordcloud
        words={words}
        width={width}
        height={height}
        options={options}
        callbacks={callbacks}
      />
    </div>
  );
}
