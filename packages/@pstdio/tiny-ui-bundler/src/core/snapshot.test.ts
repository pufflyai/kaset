import { afterEach, describe, expect, it } from "vitest";
import { registerVirtualSnapshot, readSnapshot, unregisterVirtualSnapshot } from "./snapshot";
import { registerSources, removeSource } from "./sources";

describe("snapshot", () => {
  const root = "/workspace/project";
  const id = "snapshot";

  afterEach(() => {
    unregisterVirtualSnapshot(root);
    removeSource(id);
  });

  it("builds digests and ensures entry presence", async () => {
    const config = { id, root, entry: `${root}/src/index.tsx` } as const;
    registerSources([config]);
    registerVirtualSnapshot(root, {
      entry: `${root}/src/index.tsx`,
      files: {
        [`${root}/src/index.tsx`]: "console.log('hello')",
        [`${root}/src/components/Button.tsx`]: "export const Button = () => null;",
      },
    });

    const snapshot = await readSnapshot(config);
    expect(snapshot.entryRelative).toBe("/src/index.tsx");
    expect(Object.keys(snapshot.files)).toContain("/src/components/Button.tsx");
    expect(snapshot.digests["/src/index.tsx"]).toBeDefined();
  });

  it("throws when the entry file is missing", async () => {
    const config = { id, root, entry: `${root}/src/index.tsx` } as const;
    registerSources([config]);
    registerVirtualSnapshot(root, {
      files: {
        [`${root}/src/components/Button.tsx`]: "export const Button = () => null;",
      },
    });

    await expect(readSnapshot(config)).rejects.toThrow(
      /Virtual snapshot for snapshot is missing entry file \/src\/index.tsx/,
    );
  });
});
