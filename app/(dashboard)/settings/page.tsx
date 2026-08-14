"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { authApi } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CheckCircle, Sun, Moon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const { theme, setTheme } = useThemeStore();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ full_name: fullName }),
    onSuccess: (res) => {
      setAuth(res.data, token!);
      setSuccess("Profile updated.");
      setError("");
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Update failed"
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: currentPwd,
        new_password: newPwd,
      }),
    onSuccess: () => {
      setSuccess("Password changed.");
      setCurrentPwd("");
      setNewPwd("");
      setError("");
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Password change failed"
      );
    },
  });

  const inputClass =
    "w-full px-3 py-2 border border-border dark:border-border rounded-lg text-sm bg-card dark:bg-background text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Breadcrumb items={[{ label: "Settings" }]} />

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-0.5">
          Manage your account and preferences
        </p>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Appearance */}
      <div className="bg-card dark:bg-secondary rounded-xl border border-border dark:border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground dark:text-foreground mb-1">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
          Choose your preferred interface theme
        </p>
        <div className="flex gap-3">
          {(["light", "dark"] as const).map((t) => {
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl border-2 transition-all",
                  active
                    ? "border-brand bg-brand/5 dark:bg-brand/10"
                    : "border-border dark:border-border hover:border-brand/40 dark:hover:border-brand/40"
                )}
              >
                {t === "light" ? (
                  <Sun
                    className={cn(
                      "w-5 h-5",
                      active
                        ? "text-brand"
                        : "text-muted-foreground dark:text-muted-foreground"
                    )}
                  />
                ) : (
                  <Moon
                    className={cn(
                      "w-5 h-5",
                      active
                        ? "text-brand"
                        : "text-muted-foreground dark:text-muted-foreground"
                    )}
                  />
                )}
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-xs font-medium capitalize",
                      active
                        ? "text-brand"
                        : "text-muted-foreground dark:text-muted-foreground"
                    )}
                  >
                    {t}
                  </span>
                  {t === "dark" && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold leading-none">
                      <Sparkles className="w-2.5 h-2.5" />
                      Beta
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile */}
      <div className="bg-card dark:bg-secondary rounded-xl border border-border dark:border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground dark:text-foreground mb-4">
          Profile
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-foreground/80 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full px-3 py-2 border border-border dark:border-border rounded-lg text-sm text-muted-foreground dark:text-muted-foreground bg-muted dark:bg-background cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-foreground/80 mb-1">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 transition"
          >
            {updateMutation.isPending ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card dark:bg-secondary rounded-xl border border-border dark:border-border p-6">
        <h2 className="text-base font-semibold text-foreground dark:text-foreground mb-4">
          Change Password
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-foreground/80 mb-1">
              Current password
            </label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-foreground/80 mb-1">
              New password
            </label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            onClick={() => passwordMutation.mutate()}
            disabled={!currentPwd || !newPwd || passwordMutation.isPending}
            className="px-4 py-2 bg-gray-800 dark:bg-foreground/10 dark:border dark:border-border text-white dark:text-foreground rounded-lg text-sm font-medium hover:bg-gray-900 dark:hover:bg-foreground/15 disabled:opacity-50 transition"
          >
            {passwordMutation.isPending ? "Changing..." : "Change password"}
          </button>
        </div>
      </div>
    </div>
  );
}
