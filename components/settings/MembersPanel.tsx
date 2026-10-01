"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { PageSpinner } from "@/components/shared/LoadingBar";
import type { WorkspaceMember } from "@/types";

const ROLES = ["admin", "analyst", "viewer"] as const;
const ROLE_TAG: Record<string, string> = {
  admin: "bg-[#ff6196]/10 text-[#C30D5C]",
  analyst: "bg-brand/10 text-brand",
  viewer: "bg-muted text-muted-foreground",
};

/** Invite, list and remove the members of one workspace. */
function MembersPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("analyst");
  const [error, setError] = useState("");

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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) }),
  });

  return (
    <div className="space-y-4">
      {user?.is_admin && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-jman-trypan mb-2 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Invite a member
          </div>
          {error && (
            <div className="mb-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
          )}
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@jmangroup.com"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand" />
            <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand">
              {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
            <button onClick={() => inviteMutation.mutate()} disabled={!email.trim() || inviteMutation.isPending}
              className="px-4 py-2 bg-brand text-brand-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition">
              {inviteMutation.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? <PageSpinner /> : (
        <div className="rounded-lg border border-border overflow-hidden">
          {(members ?? []).map((m: WorkspaceMember, i: number) => (
            <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {(m.user?.full_name ?? m.user?.email ?? "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.user?.full_name ?? m.user?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{m.user?.email}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${ROLE_TAG[m.role] ?? "bg-muted text-muted-foreground"}`}>{m.role}</span>
              {m.joined_at && <span className="text-xs text-muted-foreground hidden sm:block">{formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</span>}
              {user?.is_admin && m.user?.email !== user.email && (
                <button onClick={() => removeMutation.mutate(m.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition" title="Remove member">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {!members?.length && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No members yet</div>}
        </div>
      )}
    </div>
  );
}

/** Settings card: pick a workspace, manage who has access. Shown to admins only. */
export function MembersSection() {
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [picked, setPicked] = useState<string | null>(null);
  const { data: workspaces } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list().then((r) => r.data as Array<{ id: string | number; name: string }>),
  });
  const list = workspaces ?? [];
  const selected = picked ?? (list.find((w) => String(w.id) === String(currentWorkspaceId))?.id ?? list[0]?.id);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Workspace members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage who has access to a workspace and their role.</p>
        </div>
        {list.length > 1 && (
          <select value={String(selected ?? "")} onChange={(e) => setPicked(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-brand">
            {list.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
          </select>
        )}
      </div>
      {selected != null ? <MembersPanel key={String(selected)} workspaceId={String(selected)} /> : <p className="text-sm text-muted-foreground">No workspaces yet.</p>}
    </div>
  );
}
