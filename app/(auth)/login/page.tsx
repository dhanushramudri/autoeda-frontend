"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import type { AxiosError } from "axios";
import type { ApiError } from "@/types";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMicrosoftSSO = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;

    setLoading(true);
    setError("");

    try {
      const { data } = await authApi.microsoftMockLogin({
        email,
        full_name: email.split("@")[0],
      });

      setAuth(data.user, data.access_token);
      router.push("/workspaces");
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      setError(axiosErr.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — white panel */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center bg-white px-16 relative overflow-hidden">

        {/* Animated SVG background */}
<svg
  className="absolute inset-0 w-full h-full"
  viewBox="0 0 600 800"
  preserveAspectRatio="xMidYMid slice"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <defs>
    <style>{`
      @keyframes float1 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-16px)} }
      @keyframes float2 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-12px)} }
      @keyframes float3 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-20px)} }
      @keyframes float4 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
      @keyframes dash   { to { stroke-dashoffset: -40; } }

      .f1 { animation: float1 6s ease-in-out infinite; }
      .f2 { animation: float2 8s ease-in-out infinite 1.5s; }
      .f3 { animation: float3 7s ease-in-out infinite 0.8s; }
      .f4 { animation: float4 9s ease-in-out infinite 2s; }
      .line-anim { stroke-dasharray:6 4; animation: dash 3s linear infinite; }
    `}</style>
  </defs>

  {/* ── TOP LEFT — line chart ── */}
  <g transform="translate(30,50)">
    <g className="f2" opacity="0.11">
      <polyline points="0,70 35,40 70,55 105,20 140,38 175,12 210,30"
        fill="none" stroke="#3b1fa3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="0"   cy="70" r="4" fill="#3b1fa3"/>
      <circle cx="35"  cy="40" r="4" fill="#3b1fa3"/>
      <circle cx="70"  cy="55" r="4" fill="#3b1fa3"/>
      <circle cx="105" cy="20" r="4" fill="#3b1fa3"/>
      <circle cx="140" cy="38" r="4" fill="#3b1fa3"/>
      <circle cx="175" cy="12" r="4" fill="#3b1fa3"/>
      <circle cx="210" cy="30" r="4" fill="#3b1fa3"/>
    </g>
  </g>

  {/* ── TOP RIGHT — bar chart ── */}
  <g transform="translate(390,30)">
    <g className="f3" opacity="0.09">
      <rect x="0"  y="50" width="14" height="30" rx="2" fill="#3b1fa3"/>
      <rect x="20" y="20" width="14" height="60" rx="2" fill="#3b1fa3"/>
      <rect x="40" y="35" width="14" height="45" rx="2" fill="#3b1fa3"/>
      <rect x="60" y="5"  width="14" height="75" rx="2" fill="#3b1fa3"/>
      <rect x="80" y="15" width="14" height="65" rx="2" fill="#3b1fa3"/>
    </g>
  </g>

  {/* ── MID LEFT — scatter ── */}
  <g transform="translate(40,310)">
    <g className="f1" opacity="0.09">
      {[[0,20],[25,0],[40,35],[65,15],[85,45],[110,10],[130,30],[155,5]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="4.5" fill="#3b1fa3"/>
      ))}
      <line x1="0" y1="42" x2="160" y2="3" stroke="#3b1fa3" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
    </g>
  </g>

  {/* ── MID RIGHT — scatter ── */}
  <g transform="translate(370,280)">
    <g className="f4" opacity="0.09">
      {[[0,0],[20,30],[45,10],[60,50],[80,20],[100,40],[30,60],[70,70],[50,35]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="5" fill="#3b1fa3"/>
      ))}
      <line x1="0" y1="65" x2="110" y2="5" stroke="#3b1fa3" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
    </g>
  </g>

  {/* ── BOTTOM LEFT — bar chart ── */}
  <g transform="translate(30,580)">
    <g className="f3" opacity="0.11">
      <rect x="0"  y="60" width="18" height="40" rx="3" fill="#3b1fa3"/>
      <rect x="24" y="30" width="18" height="70" rx="3" fill="#3b1fa3"/>
      <rect x="48" y="45" width="18" height="55" rx="3" fill="#3b1fa3"/>
      <rect x="72" y="10" width="18" height="90" rx="3" fill="#3b1fa3"/>
      <rect x="96" y="25" width="18" height="75" rx="3" fill="#3b1fa3"/>
    </g>
  </g>

  {/* ── BOTTOM RIGHT — line chart ── */}
  <g transform="translate(360,620)">
    <g className="f2" opacity="0.09">
      <polyline points="0,50 30,25 60,40 90,10 120,30 150,5"
        fill="none" stroke="#3b1fa3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="0"   cy="50" r="3.5" fill="#3b1fa3"/>
      <circle cx="30"  cy="25" r="3.5" fill="#3b1fa3"/>
      <circle cx="60"  cy="40" r="3.5" fill="#3b1fa3"/>
      <circle cx="90"  cy="10" r="3.5" fill="#3b1fa3"/>
      <circle cx="120" cy="30" r="3.5" fill="#3b1fa3"/>
      <circle cx="150" cy="5"  r="3.5" fill="#3b1fa3"/>
    </g>
  </g>

  {/* ── CENTER — line chart ── */}
  <g transform="translate(160,380)">
    <g className="f1" opacity="0.08">
      <polyline points="0,40 40,15 80,30 120,5 160,20"
        fill="none" stroke="#3b1fa3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="0"   cy="40" r="3.5" fill="#3b1fa3"/>
      <circle cx="40"  cy="15" r="3.5" fill="#3b1fa3"/>
      <circle cx="80"  cy="30" r="3.5" fill="#3b1fa3"/>
      <circle cx="120" cy="5"  r="3.5" fill="#3b1fa3"/>
      <circle cx="160" cy="20" r="3.5" fill="#3b1fa3"/>
    </g>
  </g>

  {/* ── Animated connector lines ── */}
  <g opacity="0.06">
    <line className="line-anim" x1="50"  y1="590" x2="220" y2="390" stroke="#3b1fa3" strokeWidth="1.5"/>
    <line className="line-anim" x1="430" y1="80"  x2="530" y2="290" stroke="#3b1fa3" strokeWidth="1.5"/>
    <line className="line-anim" x1="160" y1="160" x2="390" y2="310" stroke="#3b1fa3" strokeWidth="1.5"/>
    <line className="line-anim" x1="370" y1="630" x2="500" y2="450" stroke="#3b1fa3" strokeWidth="1.5"/>
  </g>
</svg>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6 select-none">
          <div className="w-40 h-40 rounded-2xl overflow-hidden flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="AutoEDA" className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">AutoEDA</h1>
            <p className="mt-2 text-base text-gray-400 font-medium tracking-wide">
              Automated Exploratory Data Analysis
            </p>
          </div>
        </div>
      </div>

      {/* Right — blue panel */}
      <div className="flex-1 flex items-center justify-center bg-brand px-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              <img src="/logo.png" alt="AutoEDA" className="w-full h-full object-contain" />
            </div>
            <span className="text-white text-xl font-bold">AutoEDA</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-white/50 text-sm mb-8">Sign in to continue</p>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-white/10 border border-white/20 text-white/90 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleMicrosoftSSO} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@jmangroup.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-white text-[#3b1fa3] font-semibold rounded-xl text-sm hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 focus:ring-offset-[#3b1fa3] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-[#3b1fa3]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}