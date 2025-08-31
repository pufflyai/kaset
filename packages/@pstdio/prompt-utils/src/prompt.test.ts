import { describe, it, expect } from "vitest";
import { prompt, line, listAnd, listOr, section } from "./prompt";

describe("prompt utils: prompt tag", () => {
  it("strips common indentation, trims edges, keeps max 2 blank lines", () => {
    const out = prompt`
      Title



      Body line 1
        Body line 2
    `;

    // Should trim outer edges, keep at most two blank lines between
    expect(out).toBe("Title\n\nBody line 1\n  Body line 2");
  });

  it("interpolates values correctly", () => {
    const name = "World";
    const out = prompt`
      Hello, ${name}!
    `;
    expect(out).toBe("Hello, World!");
  });
});

describe("prompt utils: line tag", () => {
  it("collapses newlines and extra spaces into single spaces", () => {
    const out = line`
      A   multi-line\n
      title
        with   extra   spaces
    `;
    expect(out).toBe("A multi-line title with extra spaces");
  });
});

describe("prompt utils: list helpers", () => {
  it("formats listAnd", () => {
    expect(listAnd(["A"])).toBe("A");
    expect(listAnd(["A", "B"])).toBe("A and B");
    expect(listAnd(["A", "B", "C"])).toBe("A, B and C");
  });

  it("formats listOr", () => {
    expect(listOr(["A"])).toBe("A");
    expect(listOr(["A", "B"])).toBe("A or B");
    expect(listOr(["A", "B", "C"])).toBe("A, B or C");
  });

  it("respects singleLine flag while template spans lines", () => {
    const arr = ["one", "two", "three"];
    // When used via listAnd/listOr with singleLine=true this should be one-line
    expect(listAnd(arr, true)).toBe("one, two and three");
    expect(listOr(arr, true)).toBe("one, two or three");
  });
});

describe("prompt utils: section", () => {
  it("wraps content in labeled tags and preserves nested formatting", () => {
    const content = prompt`
      First line

      Second line
    `;
    const out = section("CONTEXT", content);
    expect(out).toBe(`<CONTEXT>\nFirst line\n\nSecond line\n</CONTEXT>`);
  });
});
