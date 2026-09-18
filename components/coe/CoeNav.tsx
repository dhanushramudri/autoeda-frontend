"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { coeApi, docsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { COE_CATEGORIES } from "./categoryConfig";
import type { CoePost } from "@/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold tracking-widest uppercase text-sidebar-foreground/40 select-none">
      {children}
    </p>
  );
}

export function CoeNav() {
  const pathname = usePathname();
  const params = useParams<{ category?: string }>();
  const onPlaybooks = pathname.startsWith("/library");
  const activeCoeKey = !onPlaybooks ? params?.category ?? "all" : null;

  const { data: posts } = useQuery({
    queryKey: queryKeys.coe.posts(),
    queryFn: () => coeApi.list().then((r) => r.data as CoePost[]),
  });

  const { data: categories } = useQuery({
    queryKey: queryKeys.docs.categories(),
    queryFn: () => docsApi.listCategories().then((r) => r.data as { article_count: number }[]),
  });

  const playbookCount = categories?.reduce((s, c) => s + c.article_count, 0) ?? 0;
  const countFor = (key: string) =>
    key === "all" ? posts?.length ?? 0 : posts?.filter((p) => p.category === key).length ?? 0;

  const itemClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
      !isActive && "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
    );
  const itemStyle = (isActive: boolean) =>
    isActive
      ? {
          backgroundColor: "hsl(var(--primary) / 0.10)",
          color: "hsl(var(--primary))",
          fontWeight: 600,
          borderLeft: "1px solid hsl(var(--primary))",
        }
      : {};
  const badgeStyle = (isActive: boolean) =>
    isActive
      ? { backgroundColor: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }
      : { backgroundColor: "hsl(var(--sidebar-accent))", color: "inherit" };

  return (
    <aside className="w-56 flex-shrink-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="px-4 pt-5 pb-3 border-b border-sidebar-border">
        <h1 className="text-sm font-bold text-sidebar-foreground leading-tight">DS Delivery Hub</h1>
        <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">Playbooks, news &amp; more</p>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-3">
        <SectionLabel>Playbooks</SectionLabel>
        <Link href="/library" className={itemClass(onPlaybooks)} style={itemStyle(onPlaybooks)}>
          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Delivery Playbooks</span>
          {playbookCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={badgeStyle(onPlaybooks)}>
              {playbookCount}
            </span>
          )}
        </Link>

        <SectionLabel>CoE Pulse</SectionLabel>
        <div className="space-y-0.5">
          {COE_CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isActive = activeCoeKey === c.key;
            const count = countFor(c.key);
            return (
              <Link key={c.key} href={`/coe-pulse/${c.key}`} className={itemClass(isActive)} style={itemStyle(isActive)}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">{c.label}</span>
                {count > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={badgeStyle(isActive)}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
