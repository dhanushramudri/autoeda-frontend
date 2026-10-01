import { workspacesApi } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * Where a signed-in user should land: the Solutions page of their last-used workspace (or the first one),
 * or the Workspaces page when they have none yet. `welcome=1` lets Solutions show its short first-visit tour.
 */
export async function resolveLanding(): Promise<string> {
  try {
    const { data: list } = await workspacesApi.list();
    if (Array.isArray(list) && list.length > 0) {
      const saved = useWorkspaceStore.getState().currentWorkspaceId;
      const ws = list.find((w: { id: string | number }) => String(w.id) === String(saved)) ?? list[0];
      return `/workspaces/${ws.id}/ds-flows?welcome=1`;
    }
  } catch {
    // fall through to the Workspaces page
  }
  return "/workspaces";
}
