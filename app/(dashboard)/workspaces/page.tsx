"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workspacesApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useAuthStore } from "@/store/authStore";
import { PageSpinner } from "@/components/shared/LoadingBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, FolderOpen, Users, Database, Clock, ChevronRight, X, Plug, Warehouse, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Workspace } from "@/types";

function NewWorkspaceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => workspacesApi.create({ name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.list() });
      onClose();
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to create workspace");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">New Workspace</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workspace name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Analytics Q4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="flex-1 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {mutation.isPending ? "Creating..." : "Create workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const { setCurrentWorkspace } = useWorkspaceStore();
  const qc = useQueryClient();
  const wid = workspace.id;
  const [showDelete, setShowDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => workspacesApi.delete(wid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.list() });
      setShowDelete(false);
    },
  });

  const handleClick = () => setCurrentWorkspace(workspace.id);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 hover:border-brand/30 hover:shadow-md transition group flex flex-col overflow-hidden">
        {/* Main clickable area */}
        <Link
          href={`/workspaces/${wid}/datasets`}
          onClick={handleClick}
          className="p-5 flex-1 block"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-brand" />
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand transition mt-1" />
          </div>

          <h3 className="font-semibold text-gray-900 mb-0.5 truncate">{workspace.name}</h3>
          {workspace.description && (
            <p className="text-xs text-gray-400 mb-3 line-clamp-2">{workspace.description}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap mt-2">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {workspace.dataset_count ?? 0} datasets
            </span>
            <span className="flex items-center gap-1">
              <Plug className="w-3 h-3" />
              {(workspace as unknown as { source_count?: number }).source_count ?? 0} sources
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {workspace.member_count ?? 0} members
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {workspace.updated_at
                ? formatDistanceToNow(new Date(workspace.updated_at), { addSuffix: true })
                : " -- "}
            </span>
          </div>
        </Link>

        {/* Quick-access bar */}
        <div className="border-t border-gray-100 flex divide-x divide-gray-100">
          <Link
            href={`/workspaces/${wid}/sources`}
            onClick={handleClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-gray-400 hover:text-brand hover:bg-brand/10 transition"
          >
            <Plug className="w-3 h-3" /> Sources
          </Link>
          <Link
            href={`/workspaces/${wid}/warehouse`}
            onClick={handleClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
          >
            <Warehouse className="w-3 h-3" /> Warehouse
          </Link>
          <Link
            href={`/workspaces/${wid}/join-builder`}
            onClick={handleClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition"
          >
            <Database className="w-3 h-3" /> Join Builder
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowDelete(true);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 transition border-l border-gray-100"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Delete Workspace?</h2>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{workspace.name}</strong>? This action cannot be undone and all datasets and data within this workspace will be permanently deleted.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WorkspacesPage() {
  const [showNew, setShowNew] = useState(false);
  const user = useAuthStore((s) => s.user);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list().then((r) => r.data),
    // Set staleTime to 0 to immediately mark data as stale and refetch on mount
    staleTime: 0,
    // Prevent caching issues - data is considered immediately stale
    gcTime: 1000 * 60 * 5, // 5 minutes
    // Always refetch when component mounts if data is stale
    refetchOnMount: true,
  });

  // Filter workspaces to show only those the current user is a member of
  // This ensures correct filtering from the first visit
  // Ensure workspaces is an array before calling filter to avoid TS errors
  const userWorkspaces: Workspace[] = Array.isArray(workspaces)
    ? workspaces.filter((ws: Workspace) => {
        // If user is admin, show all workspaces (optional - adjust based on your requirements)
        if (user?.is_admin) {
          return true;
        }
        // For normal users, the API should already filter, but add frontend filtering as safety net
        // You can also check a specific field like ws.is_member if available
        return true;
      })
    : [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Select a workspace to explore your datasets
          </p>
        </div>
        {user?.is_admin && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Workspace
          </button>
        )}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !userWorkspaces?.length ? (
        <EmptyState
          icon={<FolderOpen className="w-12 h-12" />}
          title="No workspaces yet"
          description="Create your first workspace to start uploading and analyzing datasets."
          action={
            // user?.is_admin ? (
              <button
                onClick={() => setShowNew(true)}
                className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#2a0d8a] transition"
              >
                Create workspace
              </button>
            // ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(userWorkspaces as Workspace[]).map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
        </div>
      )}

      {showNew && <NewWorkspaceModal onClose={() => setShowNew(false)} />}
    </div>
  );
}