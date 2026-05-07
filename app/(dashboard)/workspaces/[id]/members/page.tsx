"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { useAuthStore } from "@/store/authStore";
import { UserPlus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WorkspaceMember } from "@/types";

const ROLES = ["admin", "analyst", "viewer"] as const;

export default function MembersPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "analyst" | "viewer">("analyst");
  const [error, setError] = useState("");

  const { data: workspace } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspacesApi.get(workspaceId).then((r) => r.data),
  });

  const { data: members, isLoading } = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId),
    queryFn: () => workspacesApi.listMembers(workspaceId).then((r) => r.data),
  });

  const inviteMutation = useMutation({
    mutationFn: () => workspacesApi.addMember(workspaceId, { email, role }),
    onSuccess: () => {
      setEmail("");
      setError("");
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to add member");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspacesApi.removeMember(workspaceId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) });
    },
  });

  const ROLE_BADGE: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    analyst: "bg-blue-100 text-blue-700",
    viewer: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Workspaces", href: "/workspaces" },
          { label: workspace?.name ?? "Workspace", href: `/workspaces/${workspaceId}/datasets` },
          { label: "Members" },
        ]}
      />

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workspace Members</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage access and roles for {workspace?.name}
        </p>
      </div>

      {/* Invite form */}
      {user?.is_admin && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Invite Member
          </h2>

          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@jmangroup.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
            <button
              onClick={() => inviteMutation.mutate()}
              disabled={!email.trim() || inviteMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {inviteMutation.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {(members ?? []).map((member: WorkspaceMember, i: number) => (
            <div
              key={member.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i > 0 ? "border-t border-gray-50" : ""
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-semibold">
                {(member.user?.full_name ?? member.user?.email ?? "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {member.user?.full_name ?? member.user?.email}
                </p>
                <p className="text-xs text-gray-400 truncate">{member.user?.email}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[member.role] ?? "bg-gray-100 text-gray-600"}`}>
                {member.role}
              </span>
              {member.joined_at && (
                <span className="text-xs text-gray-400 hidden sm:block">
                  {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                </span>
              )}
              {user?.is_admin && member.user?.email !== user.email && (
                <button
                  onClick={() => removeMutation.mutate(member.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition"
                  title="Remove member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {!members?.length && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No members yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
