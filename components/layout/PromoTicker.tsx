"use client";

import { AlertTriangle } from "lucide-react";

export const PROMO_TICKER_HEIGHT = 40; // px — kept in sync with layouts that need to reserve space for this

const PROMO_MESSAGE =
  "DO NOT upload client or confidential datasets — this is a TEST environment. Use sample / dummy data only.";

export function PromoTicker() {
  return (
    <div
      className="w-full flex items-center overflow-hidden shadow-md relative z-[60] flex-shrink-0"
      style={{ height: PROMO_TICKER_HEIGHT, background: "linear-gradient(90deg, #dc2626, #e11d48, #dc2626)" }}
    >
      <style>{`
        @keyframes promo-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes promo-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(1.15); }
        }
        .promo-track { animation: promo-scroll 26s linear infinite; }
        .promo-icon  { animation: promo-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="promo-track flex items-center gap-20 whitespace-nowrap pl-8">
        {[0, 1].map((i) => (
          <span key={i} className="flex items-center gap-2.5 text-sm font-bold text-white uppercase tracking-wide">
            <AlertTriangle className="promo-icon w-4 h-4 flex-shrink-0" />
            {PROMO_MESSAGE}
          </span>
        ))}
      </div>
    </div>
  );
}
