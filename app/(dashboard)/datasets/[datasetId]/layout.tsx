import { DatasetNav } from "@/components/layout/DatasetNav";

export default function DatasetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-full">
      <DatasetNav />
      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
}
