import type { Manifest, PluginSurfaces } from "@pstdio/tiny-plugins";

type Dimensions = {
  width: number;
  height: number;
};

type Coordinates = {
  x: number;
  y: number;
};

export type PluginDesktopWindowDescriptor = {
  entry: string;
  dependencies?: Record<string, string>;
};

type DesktopSurfaceManifest = {
  id?: string;
  title?: string;
  description?: string;
  icon?: string;
  singleton?: boolean;
  defaultSize?: Partial<Dimensions>;
  defaultPosition?: Partial<Coordinates>;
  window?: {
    entry?: string;
    dependencies?: Record<string, string>;
  };
};

export type PluginDesktopSurface = {
  pluginId: string;
  surfaceId: string;
  title: string;
  description?: string;
  icon?: string;
  singleton?: boolean;
  defaultSize?: Dimensions;
  defaultPosition?: Coordinates;
  window?: PluginDesktopWindowDescriptor;
};

interface DeriveDesktopSurfacesOptions {
  pluginId: string;
  surfaces?: PluginSurfaces;
  manifest?: Manifest | null;
  displayName: string;
}

// Derives normalized desktop surfaces so the playground can render plugin windows described in the manifest.
export function deriveDesktopSurfaces(options: DeriveDesktopSurfacesOptions): PluginDesktopSurface[] {
  const { pluginId, surfaces, manifest, displayName } = options;
  const manifestDependencies = manifest?.dependencies;
  const fallbackTitle = displayName || manifest?.name || pluginId;
  const desktopConfig = extractDesktopSources(surfaces, manifest);

  if (desktopConfig.length === 0) return [];

  return normalizeDesktopSurfaces(pluginId, desktopConfig, fallbackTitle, manifestDependencies);
}

// Collects desktop configurations from either the provided surfaces snapshot or the manifest surfaces map.
function extractDesktopSources(surfaces?: PluginSurfaces, manifest?: Manifest | null): DesktopSurfaceManifest[] {
  const fromSurfaces = isRecord(surfaces) && "desktop" in surfaces ? (surfaces.desktop as unknown) : undefined;
  const rawManifestSurfaces = manifest?.surfaces;
  const manifestSurfaces = isRecord(rawManifestSurfaces) ? rawManifestSurfaces.desktop : undefined;
  const source = fromSurfaces ?? manifestSurfaces;
  return toDesktopManifestList(source);
}

// Normalizes manifest shapes into a list to simplify downstream processing.
function toDesktopManifestList(source: unknown): DesktopSurfaceManifest[] {
  if (!source) return [];

  const list = Array.isArray(source) ? source : [source];
  const result: DesktopSurfaceManifest[] = [];

  list.forEach((item) => {
    if (!isRecord(item)) return;
    result.push({ ...item });
  });

  return result;
}

// Converts raw manifest entries into PluginDesktopSurface records that the desktop runtime can consume.
function normalizeDesktopSurfaces(
  pluginId: string,
  items: DesktopSurfaceManifest[],
  fallbackTitle: string,
  manifestDependencies?: Record<string, string>,
): PluginDesktopSurface[] {
  const normalized: PluginDesktopSurface[] = [];

  items.forEach((item, index) => {
    const surfaceId = item.id?.trim() || `desktop-${index}`;
    const title = item.title?.trim() || fallbackTitle;
    const description = item.description?.trim();
    const icon = item.icon?.trim();
    const singleton = typeof item.singleton === "boolean" ? item.singleton : undefined;
    const defaultSize = normalizeDimensions(item.defaultSize);
    const defaultPosition = normalizeCoordinates(item.defaultPosition);
    const window = resolveWindowDescriptor(item, manifestDependencies);

    if (!window) return;

    normalized.push({
      pluginId,
      surfaceId,
      title,
      description,
      icon,
      singleton,
      defaultSize,
      defaultPosition,
      window,
    });
  });

  return normalized.sort((a, b) => a.surfaceId.localeCompare(b.surfaceId, undefined, { sensitivity: "base" }));
}

// Resolves the nested window descriptor so each surface knows how to render its window.
function resolveWindowDescriptor(
  item: DesktopSurfaceManifest,
  manifestDependencies?: Record<string, string>,
): PluginDesktopWindowDescriptor | undefined {
  return normalizeWindowSection(item.window, manifestDependencies);
}

// Validates and clones data from the dedicated window block, keeping dependencies scoped to that window.
function normalizeWindowSection(
  window?: DesktopSurfaceManifest["window"],
  fallbackDependencies?: Record<string, string>,
): PluginDesktopWindowDescriptor | undefined {
  if (!window) return undefined;
  const entry = sanitizeEntryPath(window.entry);
  if (!entry) return undefined;
  const dependencies = window.dependencies
    ? { ...window.dependencies }
    : fallbackDependencies
      ? { ...fallbackDependencies }
      : undefined;
  return { entry, dependencies };
}

function sanitizeEntryPath(entry?: string) {
  const trimmed = entry?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^\/+/, "");
  if (!normalized) return null;
  return normalized;
}

function normalizeDimensions(value?: Partial<Dimensions>): Dimensions | undefined {
  if (!value) return undefined;
  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return { width, height };
}

function normalizeCoordinates(value?: Partial<Coordinates>): Coordinates | undefined {
  if (!value) return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
