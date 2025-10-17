import { describe, expect, it } from "vitest";
import { computeHash, computeLockfileHash, hashText } from "../src/core/hash";

describe("hash", () => {
  it("produces identical lockfile hashes for order-insensitive inputs", async () => {
    const hashA = await computeLockfileHash({ react: "1.0.0", z: "2.0.0" });
    const hashB = await computeLockfileHash({ z: "2.0.0", react: "1.0.0" });
    expect(hashA).toBe(hashB);
  });

  it("changes the bundle hash when digests change", async () => {
    const base = {
      id: "id",
      root: "/root",
      entryRelativePath: "/index.tsx",
      digests: { "/file": "digest-a" },
      tsconfig: null,
      lockfile: null,
    };

    const hashA = await computeHash(base);
    const hashB = await computeHash({ ...base, digests: { "/file": "digest-b" } });
    expect(hashA).not.toBe(hashB);
  });

  it("hashText is deterministic", async () => {
    const first = await hashText("hello world");
    const second = await hashText("hello world");
    expect(first).toBe(second);
  });
});
