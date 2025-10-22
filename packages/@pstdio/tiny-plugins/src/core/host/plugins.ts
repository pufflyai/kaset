import type { ChangeRecord } from "@pstdio/opfs-utils";
import { createPluginFs } from "../fs";
import { readManifestStrict } from "../manifest";
import { listFiles, watchPluginDir } from "../watchers";
import type { Manifest, PluginContext, PluginModule } from "../types";
import { buildHostApi } from "./hostApi";
import type { HostRuntime, HostState, LifecycleHooks } from "./internalTypes";
import { pluginRootPath, shouldEmitPluginsChange } from "./utils";
import { createWorkerBridge, disposeWorkerBridge } from "./workerBridge";

function ensureWorker(state?: HostState) {
  if (!state?.worker) throw new Error(`Worker is not available`);
  return state.worker;
}

export async function loadPlugin(
  pluginId: string,
  runtime: HostRuntime,
  hooks: LifecycleHooks,
  opts?: { emitChange?: boolean },
) {
  const shouldEmitChange = opts?.emitChange !== false;
  const prevState = runtime.states.get(pluginId);
  const fs = createPluginFs(runtime.root, pluginId);

  const mres = await readManifestStrict(
    async (p) => new TextDecoder().decode(await fs.readFile(p)),
    pluginId,
    runtime.hostApiVersion,
  );

  if (!mres.ok) {
    const nextState: HostState = { manifest: null, watcherCleanup: prevState?.watcherCleanup };
    runtime.states.set(pluginId, nextState);

    if (shouldEmitPluginsChange(prevState, nextState)) hooks.emitPluginsChange();

    hooks.emitStatus(`manifest invalid for ${pluginId}: ${mres.error}`, pluginId, mres.details ?? mres);

    if (shouldEmitChange) {
      runtime.emitter.emit("pluginChange", {
        pluginId,
        payload: {
          paths: [],
          manifest: null,
          files: await listFiles(pluginRootPath(runtime.root, pluginId)),
          changes: undefined,
        },
      });
    }

    return;
  }

  const manifest = mres.manifest;
  const entry = manifest.entry;

  const code = new TextDecoder().decode(await fs.readFile(entry));
  const blob = new Blob([code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);

  const api = buildHostApi({
    root: runtime.root,
    dataRoot: runtime.dataRoot,
    workspaceRoot: runtime.workspaceRoot,
    pluginId,
    notify: runtime.notify,
    emitter: runtime.emitter,
  });

  const ctx: PluginContext = { id: pluginId, manifest, api };

  let nextState: (HostState & { manifest: Manifest; moduleUrl: string; ctx: PluginContext }) | undefined;

  if (runtime.workerEnabled) {
    let bridge;
    try {
      bridge = await createWorkerBridge(pluginId, api);
      const ready = await bridge.init(manifest, url);

      const handlers: Record<string, (c: PluginContext, params?: unknown) => Promise<unknown> | unknown> = {};
      ready.commandIds.forEach((commandId) => {
        handlers[commandId] = (_c, params) => ensureWorker(runtime.states.get(pluginId)).runCommand(commandId, params);
      });

      runtime.commands.register(pluginId, manifest.commands, handlers);

      nextState = {
        manifest,
        moduleUrl: url,
        ctx,
        watcherCleanup: prevState?.watcherCleanup,
        worker: bridge,
        plugin: undefined,
        module: undefined,
      };
    } catch (error) {
      await disposeWorkerBridge(pluginId, bridge, url);
      throw error instanceof Error ? error : new Error(String(error));
    }
  } else {
    let mod: PluginModule;
    try {
      mod = (await import(/* @vite-ignore */ url)) as PluginModule;
    } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error(`Failed to import ${pluginId}:${entry} - ${(e as Error).message}`);
    }

    const plugin = mod?.default;
    if (!plugin || typeof plugin.activate !== "function") {
      URL.revokeObjectURL(url);
      throw new Error(`Plugin ${pluginId} default export must implement activate()`);
    }

    await plugin.activate(ctx);
    runtime.commands.register(pluginId, manifest.commands, mod.commands);

    nextState = {
      manifest,
      moduleUrl: url,
      module: mod,
      plugin,
      ctx,
      watcherCleanup: prevState?.watcherCleanup,
      worker: undefined,
    };
  }

  if (!nextState) {
    URL.revokeObjectURL(url);
    throw new Error(`Failed to initialize state for ${pluginId}`);
  }

  runtime.states.set(pluginId, nextState);

  if (prevState?.worker) {
    await disposeWorkerBridge(pluginId, prevState.worker, prevState.moduleUrl);
  } else if (prevState?.moduleUrl) {
    URL.revokeObjectURL(prevState.moduleUrl);
  }

  if (shouldEmitPluginsChange(prevState, nextState)) hooks.emitPluginsChange();

  if (shouldEmitChange) {
    runtime.emitter.emit("pluginChange", {
      pluginId,
      payload: {
        paths: [],
        manifest,
        files: await listFiles(pluginRootPath(runtime.root, pluginId)),
        changes: undefined,
      },
    });
  }
}

export async function unloadPlugin(pluginId: string, runtime: HostRuntime) {
  const state = runtime.states.get(pluginId);
  runtime.commands.unregister(pluginId);
  try {
    await state?.plugin?.deactivate?.();
  } catch (error) {
    console.warn(`[tiny-plugins] deactivate error for ${pluginId}`, error);
  }

  if (state?.worker) {
    await disposeWorkerBridge(pluginId, state.worker, state.moduleUrl);
  } else if (state?.moduleUrl) {
    URL.revokeObjectURL(state.moduleUrl);
  }

  runtime.states.delete(pluginId);
}

export async function startPluginWatcher(pluginId: string, runtime: HostRuntime, hooks: LifecycleHooks) {
  if (!runtime.watch) return;
  const rootPath = pluginRootPath(runtime.root, pluginId);

  const cleanup = await watchPluginDir(rootPath, async (changes: ChangeRecord[]) => {
    const paths = [...new Set(changes.map((c) => c.path.join("/")))];
    try {
      await loadPlugin(pluginId, runtime, hooks); // hot reload
      runtime.emitter.emit("pluginChange", {
        pluginId,
        payload: {
          paths,
          manifest: runtime.states.get(pluginId)?.manifest ?? null,
          files: await listFiles(rootPath),
          changes,
        },
      });
      hooks.emitDependenciesChanged();
    } catch (error) {
      hooks.emitError(error as Error);
    }
  });

  const state = runtime.states.get(pluginId);
  if (state) state.watcherCleanup = cleanup;
}

export async function handlePluginRemoval(
  pluginId: string,
  changes: ChangeRecord[],
  runtime: HostRuntime,
  hooks: LifecycleHooks,
) {
  const state = runtime.states.get(pluginId);
  if (!state) return;

  try {
    await state.watcherCleanup?.();
  } catch {
    /* ignore */
  }

  const emitChange = shouldEmitPluginsChange(state, undefined);
  await unloadPlugin(pluginId, runtime);
  if (emitChange) hooks.emitPluginsChange();

  const paths = [...new Set(changes.map((change) => change.path.join("/")))];
  runtime.emitter.emit("pluginChange", {
    pluginId,
    payload: {
      paths,
      manifest: null,
      files: await listFiles(pluginRootPath(runtime.root, pluginId)),
      changes,
    },
  });
  hooks.emitDependenciesChanged();
}

export async function handlePluginAddition(pluginId: string, runtime: HostRuntime, hooks: LifecycleHooks) {
  if (runtime.states.has(pluginId)) return;
  try {
    await loadPlugin(pluginId, runtime, hooks);
    await startPluginWatcher(pluginId, runtime, hooks);
    hooks.emitDependenciesChanged();
  } catch (error) {
    hooks.emitError(error as Error);
  }
}
