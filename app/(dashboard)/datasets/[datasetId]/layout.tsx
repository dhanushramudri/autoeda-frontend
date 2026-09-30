"use client";

import { useEffect, useState } from "react";
import { DatasetNav } from "@/components/layout/DatasetNav";

export default function DatasetLayout({ children }: { children: React.ReactNode }) {
  // ?embed=1 (used inside Data Science Flow steps): page only, without the dataset side navigation
  const [embed, setEmbed] = useState<boolean | null>(null);
  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).get("embed") === "1");
  }, []);
  if (embed === null) return null;
  if (embed) return <div className="min-h-full">{children}</div>;
  return (
    <div className="flex h-full min-h-full">
      <DatasetNav />
      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
}
