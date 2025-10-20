import type { UIMessage } from "@pstdio/kas/kas-ui";
import type { IconName } from "lucide-react/dynamic";
import type { ReactNode } from "react";

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export const DEFAULT_DESKTOP_APP_ICON: IconName = "app-window-mac";

export interface DesktopApp {
  id: string;
  title: string;
  icon: IconName;
  description: string;
  defaultSize: Size;
  singleton?: boolean;
  defaultPosition?: Position;
  render: (windowId: string) => ReactNode;
}

export interface DesktopWindow {
  id: string;
  appId: string;
  title: string;
  position: Position;
  size: Size;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  openedAt: number;
  restoreBounds?: {
    position: Position;
    size: Size;
  };
  snapRestore?: {
    position: Position;
    size: Size;
  };
  snapSide?: "left" | "right";
}

export interface DesktopState {
  windows: DesktopWindow[];
  nextZIndex: number;
}

export interface Conversation {
  id: string;
  name: string;
  messages: UIMessage[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  accessToken?: string;
}

export type ThemePreference = "light" | "dark";

export interface WorkspaceSettings {
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  approvalGatedTools?: string[];
  mcpServers: McpServerConfig[];
  activeMcpServerIds?: string[];
  theme: ThemePreference;
  wallpaper: string;
  reactScanEnabled: boolean;
}

export interface WorkspaceState {
  version: string;
  conversations: Record<string, Conversation>;
  selectedConversationId: string;
  desktop: DesktopState;
  settings: WorkspaceSettings;
}

export type WorkspaceStore = WorkspaceState;

export type Mutators = [["zustand/devtools", never], ["zustand/immer", never], ["zustand/persist", any]];
