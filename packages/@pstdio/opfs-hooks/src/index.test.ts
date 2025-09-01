import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFileContent, useFolder } from "./index";

// TODO: PLACEHOLDER TESTS, update when implementing

describe("useFileContent", () => {
  it("should return empty content initially", () => {
    const { result } = renderHook(() => useFileContent());
    expect(result.current.content).toBe("");
  });
});

describe("useFolder", () => {
  it("should return null rootNode initially", () => {
    const { result } = renderHook(() => useFolder());
    expect(result.current.rootNode).toBeNull();
  });
});
