export type PluginNotificationEntry = {
  level: "info" | "warn" | "error";
  message: string;
  at: number;
};

export type PluginStatusSnapshot = {
  pluginId: string;
  lastReloadAt?: number;
  lastError?: string;
  notifications: PluginNotificationEntry[];
};

type PluginStatusState = {
  lastReloadAt?: number;
  lastError?: string;
  notifications: PluginNotificationEntry[];
};

type ReloadWaiter = {
  threshold: number;
  resolve: (timestamp: number) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

const NOTIFY_PATTERN = /^\s*\[(?<pluginId>[^\]]+)\]\s*(?<message>.*)$/;

const statusByPlugin = new Map<string, PluginStatusState>();
const reloadWaiters = new Map<string, Set<ReloadWaiter>>();

function getOrCreateStatus(pluginId: string): PluginStatusState {
  const existing = statusByPlugin.get(pluginId);
  if (existing) {
    return existing;
  }

  const created: PluginStatusState = { notifications: [] };
  statusByPlugin.set(pluginId, created);
  return created;
}

function notifyReloadWaiters(pluginId: string, timestamp: number) {
  const waiters = reloadWaiters.get(pluginId);
  if (!waiters || waiters.size === 0) return;

  waiters.forEach((waiter) => {
    if (timestamp <= waiter.threshold) return;
    if (waiter.timer) {
      clearTimeout(waiter.timer);
      waiter.timer = null;
    }
    waiters.delete(waiter);
    waiter.resolve(timestamp);
  });

  if (waiters.size === 0) {
    reloadWaiters.delete(pluginId);
  }
}

function failReloadWaiters(pluginId: string, error: Error) {
  const waiters = reloadWaiters.get(pluginId);
  if (!waiters || waiters.size === 0) return;

  waiters.forEach((waiter) => {
    if (waiter.timer) {
      clearTimeout(waiter.timer);
      waiter.timer = null;
    }
    waiters.delete(waiter);
    waiter.reject(error);
  });

  reloadWaiters.delete(pluginId);
}

export function markPluginReload(pluginId: string) {
  const status = getOrCreateStatus(pluginId);
  const timestamp = Date.now();
  status.lastReloadAt = timestamp;
  status.lastError = undefined;
  notifyReloadWaiters(pluginId, timestamp);
}

export function markPluginRemoved(pluginId: string) {
  statusByPlugin.delete(pluginId);
  failReloadWaiters(pluginId, new Error(`Plugin removed: ${pluginId}`));
}

export function recordPluginNotification(level: "info" | "warn" | "error", rawMessage: string) {
  const match = NOTIFY_PATTERN.exec(rawMessage);
  const pluginId = match?.groups?.pluginId?.trim();
  const message = (match?.groups?.message ?? rawMessage).trim();

  if (!pluginId) {
    return;
  }

  const status = getOrCreateStatus(pluginId);
  const entry: PluginNotificationEntry = {
    level,
    message,
    at: Date.now(),
  };

  status.notifications = [...status.notifications.slice(-49), entry];
  if (level === "error") {
    status.lastError = message;
  }
}

export function getPluginStatusSnapshot(pluginId: string): PluginStatusSnapshot | undefined {
  const status = statusByPlugin.get(pluginId);
  if (!status) {
    return undefined;
  }

  return {
    pluginId,
    lastReloadAt: status.lastReloadAt,
    lastError: status.lastError,
    notifications: [...status.notifications],
  };
}

export function getAllPluginStatusSnapshots(): PluginStatusSnapshot[] {
  return Array.from(statusByPlugin.entries())
    .map(([pluginId, status]) => ({
      pluginId,
      lastReloadAt: status.lastReloadAt,
      lastError: status.lastError,
      notifications: [...status.notifications],
    }))
    .sort((a, b) => a.pluginId.localeCompare(b.pluginId));
}

export function resetPluginStatusStore() {
  statusByPlugin.clear();
  reloadWaiters.clear();
}

export interface PluginReloadWaitOptions {
  timeoutMs?: number;
  afterReloadAt?: number;
}

export async function waitForPluginReload(
  pluginId: string,
  options: PluginReloadWaitOptions = {},
): Promise<{ pluginId: string; timestamp: number }> {
  const { timeoutMs = 15000, afterReloadAt } = options;
  const status = statusByPlugin.get(pluginId);
  const threshold = typeof afterReloadAt === "number" ? afterReloadAt : (status?.lastReloadAt ?? 0);
  const current = status?.lastReloadAt;

  if (typeof current === "number" && current > threshold) {
    return { pluginId, timestamp: current };
  }

  return new Promise<{ pluginId: string; timestamp: number }>((resolve, reject) => {
    const waiters = reloadWaiters.get(pluginId) ?? new Set<ReloadWaiter>();
    reloadWaiters.set(pluginId, waiters);

    const waiter: ReloadWaiter = {
      threshold,
      resolve: (timestamp) => {
        resolve({ pluginId, timestamp });
      },
      reject,
      timer: null,
    };

    waiters.add(waiter);

    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      waiter.timer = setTimeout(() => {
        waiters.delete(waiter);
        if (waiter.timer) {
          clearTimeout(waiter.timer);
          waiter.timer = null;
        }
        if (waiters.size === 0) {
          reloadWaiters.delete(pluginId);
        }
        reject(new Error(`Timed out waiting for plugin reload: ${pluginId}`));
      }, timeoutMs);
    }
  });
}
