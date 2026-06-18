"use client";

import { cn } from "@/lib/utils";

interface NewFeatureNudgeProps {
  label: string;
  className?: string;
}

const W = 148;
const H = 82;

const LABEL_RIGHT = W - 4;   // pill right edge x
const LABEL_TOP   = H - 22;  // pill top y
const LABEL_W     = 120;
const LABEL_CX    = LABEL_RIGHT - LABEL_W / 2; // pill center x = ~84

const TX = LABEL_CX;          // ~84
const TY = LABEL_TOP - 2;     // just above pill top

const HX = W - 18;             // ~142
const HY = 8;

const CP1X = TX - 30;         // ~54
const CP1Y = TY - 36;         // ~24
const CP2X = HX - 18;         // ~124
const CP2Y = HY + 32;         // ~40

export function NewFeatureNudge({ label, className }: NewFeatureNudgeProps) {
  return (
    <>
      <style>{`
        @keyframes nudge-in {
          from { opacity: 0; transform: translateY(-5px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes nudge-bob {
          0%, 100% { transform: translateY(0);    }
          50%       { transform: translateY(-3px); }
        }
        .nudge-root { animation: nudge-in 0.35s cubic-bezier(0.34,1.56,0.64,1); }
        .nudge-bob  { animation: nudge-bob 2.6s ease-in-out infinite; }
      `}</style>

      <div
        className={cn("nudge-root pointer-events-none absolute z-50", className)}
        style={{ width: W, height: H }}
      >
        <div className="nudge-bob relative w-full h-full">

          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            overflow="visible"
            className="absolute inset-0"
          >
            <defs>
              <marker
                id="nudge-head"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path
                  d="M2 1L8 5L2 9"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            </defs>


            <path
              d={`M ${TX} ${TY} C ${CP1X} ${CP1Y}, ${CP2X} ${CP2Y}, ${HX} ${HY}`}
              fill="none"
              stroke="#7C3AED"
              strokeWidth="1.8"
              strokeLinecap="round"
              markerEnd="url(#nudge-head)"
            />
          </svg>

          <span
            className="absolute whitespace-nowrap text-[11px] font-semibold
                       text-purple-600 bg-white px-2.5 py-0.5 rounded-full
                       shadow-sm border border-purple-200"
            style={{
              right: 4,
              bottom: 0,
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </>
  );
}