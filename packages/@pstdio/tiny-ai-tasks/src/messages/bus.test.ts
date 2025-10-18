import { describe, it, expect } from "vitest";
import { filterHistory, mergeHistory, busToBaseMessages, type ExtendedMessage } from "./bus";

describe("filterHistory", () => {
  const base: ExtendedMessage[] = [
    { role: "system", content: "s" },
    { role: "developer", content: "internal", meta: { hidden: true, tags: ["plan"] } },
    { role: "user", content: "u1" },
    { role: "assistant", content: "a1" },
    { role: "user", content: "u2", meta: { tags: ["plan"] } },
  ];

  it("excludes hidden when asked", () => {
    const out = filterHistory(base, { excludeHidden: true });
    expect(out.some((m) => m.meta?.hidden)).toBe(false);
  });

  it("filters by roles", () => {
    const out = filterHistory(base, { includeRoles: ["system", "user"] });
    expect(out.every((m) => m.role === "system" || m.role === "user")).toBe(true);
  });

  it("filters by tags (OR semantics)", () => {
    const out = filterHistory(base, { tags: ["plan"] });
    expect(out.map((m) => m.content)).toContain("internal");
    expect(out.map((m) => m.content)).toContain("u2");
  });
});

describe("mergeHistory", () => {
  it("dedupes ignoring meta and unions meta when colliding", () => {
    const a: ExtendedMessage[] = [
      { role: "user", content: "hello", meta: { tags: ["a"] } },
      { role: "assistant", content: "hi" },
    ];
    const b: ExtendedMessage[] = [
      { role: "user", content: "hello", meta: { tags: ["b"], hidden: true } },
      { role: "assistant", content: "hi" },
    ];
    const out = mergeHistory(a, b);
    const user = out.find((m) => m.role === "user")!;
    expect(out.length).toBe(2);
    expect(user.meta?.tags?.sort()).toEqual(["a", "b"]);
    expect(user.meta?.hidden).toBe(true);
  });

  it("toBaseMessages drops meta only", () => {
    const src: ExtendedMessage[] = [{ role: "user", content: "x", meta: { hidden: true, tags: ["t"] } }];
    const out = busToBaseMessages(src);
    expect((out[0] as any).meta).toBeUndefined();
    expect(out[0].role).toBe("user");
  });
});
