import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "./commands";
import type { PluginContext } from "./types";

const baseContext: PluginContext = {
  id: "plugin-a",
  manifest: { id: "plugin-a", name: "Plugin A", version: "1.0.0", api: "v1", entry: "index.js" },
  api: {} as any,
};

describe("CommandRegistry", () => {
  it("registers handlers and runs commands", async () => {
    const registry = new CommandRegistry();
    const handler = vi.fn(async (_, params) => ({ echo: params }));

    registry.register("plugin-a", [{ id: "ping", title: "Ping" }], {
      ping: handler,
      ignored: vi.fn(),
    });

    const result = await registry.run("plugin-a", "ping", baseContext, { message: "hello" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(baseContext, { message: "hello" });
    expect(result).toEqual({ echo: { message: "hello" } });
  });

  it("lists commands for a specific plugin and across all plugins", () => {
    const registry = new CommandRegistry();
    registry.register(
      "plugin-a",
      [
        { id: "a1", title: "A1" },
        { id: "a2", title: "A2" },
      ],
      { a1: vi.fn(), a2: vi.fn() },
    );
    registry.register("plugin-b", [{ id: "b1", title: "B1" }], { b1: vi.fn() });

    expect(registry.list("plugin-a")).toEqual([
      { id: "a1", title: "A1" },
      { id: "a2", title: "A2" },
    ]);
    expect(registry.listAll()).toEqual([
      { id: "a1", title: "A1", pluginId: "plugin-a" },
      { id: "a2", title: "A2", pluginId: "plugin-a" },
      { id: "b1", title: "B1", pluginId: "plugin-b" },
    ]);
  });

  it("throws when a command is missing", async () => {
    const registry = new CommandRegistry();
    registry.register("plugin-a", [{ id: "ping", title: "Ping" }], { ping: vi.fn() });

    await expect(registry.run("plugin-a", "missing", baseContext)).rejects.toThrowError(
      "Command plugin-a:missing not found",
    );
  });

  it("applies the default timeout when handlers take too long", async () => {
    vi.useFakeTimers();
    const registry = new CommandRegistry(10);
    registry.register("plugin-a", [{ id: "slow", title: "Slow" }], {
      slow: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("done"), 50);
        }),
    });

    const resultPromise = registry.run("plugin-a", "slow", baseContext);
    const expectation = expect(resultPromise).rejects.toThrowError("Operation timed out");

    try {
      await vi.advanceTimersByTimeAsync(11);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
