import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { DesktopWindow } from "@/state/types";
import type { Tool } from "@pstdio/tiny-ai-tasks";

type DesktopWindowState = "normal" | "minimized" | "maximized";

export interface DesktopWindowSummary {
  id: string;
  appId: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  state: DesktopWindowState;
  snapSide: DesktopWindow["snapSide"] | null;
  openedAt: number;
}

function getWindowState(window: DesktopWindow): DesktopWindowState {
  if (window.isMinimized) return "minimized";
  if (window.isMaximized) return "maximized";
  return "normal";
}

function toWindowSummary(window: DesktopWindow): DesktopWindowSummary {
  return {
    id: window.id,
    appId: window.appId,
    title: window.title,
    position: { ...window.position },
    size: { ...window.size },
    zIndex: window.zIndex,
    state: getWindowState(window),
    snapSide: window.snapSide ?? null,
    openedAt: window.openedAt,
  };
}

export const checkDesktopStateTool: Tool<unknown, DesktopWindowSummary[]> = {
  definition: {
    name: "check_desktop_state",
    description: "Return a snapshot of the open desktop windows, including geometry and state.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  async run() {
    const { desktop } = useWorkspaceStore.getState();

    return desktop.windows.map(toWindowSummary);
  },
};
