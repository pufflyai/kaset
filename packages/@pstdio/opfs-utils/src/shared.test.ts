import { describe, expect, it } from "vitest";
import { stripAnsi } from "./shared";

describe("stripAnsi", () => {
  it("removes common color sequences", () => {
    const input = "\u001b[31mred\u001b[0m text";
    expect(stripAnsi(input)).toBe("red text");
  });

  it("handles cursor control sequences", () => {
    const input = "start\u001b[2K\u001b[1Gline"; // clear line + move cursor
    expect(stripAnsi(input)).toBe("startline");
  });
});

