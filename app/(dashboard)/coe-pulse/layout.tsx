import { CoeNav } from "@/components/coe/CoeNav";

export default function CoePulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-full">
      <CoeNav />
      <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
}
