"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const updateMutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({ full_name: fullName }),
    onSuccess: (res) => {
      setAuth(res.data, token!);
      setSuccess("Profile updated.");
      setError("");
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Update failed");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({ current_password: currentPwd, new_password: newPwd }),
    onSuccess: () => {
      setSuccess("Password changed.");
      setCurrentPwd("");
      setNewPwd("");
      setError("");
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Password change failed");
    },
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Breadcrumb items={[{ label: "Settings" }]} />

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and preferences</p>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            onClick={() => passwordMutation.mutate()}
            disabled={!currentPwd || !newPwd || passwordMutation.isPending}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition"
          >
            {passwordMutation.isPending ? "Changing..." : "Change password"}
          </button>
        </div>
      </div>
    </div>
  );
}
