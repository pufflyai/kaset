import { describe, expect, test } from "vitest";
import { parseJSONStream } from "./parseJSONStream";

describe("parseJSONStream", () => {
  test("should parse valid JSON", () => {
    const input = '{"args": "123"}';
    const expected = { args: "123" };
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should salvage incomplete object", () => {
    // Example: the stream is truncated after the first property.
    const input = '{"args": "123", "foo"';
    // The idea is to extract the valid part: {"args": "123"}
    const expected = { args: "123" };
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should parse nested object when complete", () => {
    const input = '{"a": 1, "b": {"c": 2, "d": 3}}';
    const expected = { a: 1, b: { c: 2, d: 3 } };
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should salvage incomplete nested object", () => {
    // In this stream, the nested object is truncated.
    const input = '{"a": 1, "b": {"c": 2, "d": 3';
    // We expect to salvage up to the complete property ("c":2) and then auto-close:
    const expected = { a: 1, b: { c: 2 } };
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should parse valid array", () => {
    const input = '["a", "b", "c"]';
    const expected = ["a", "b", "c"];
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should salvage incomplete array", () => {
    const input = "[1, 2, 3,";
    const expected = [1, 2, 3];
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should ignore trailing non-JSON characters", () => {
    const input = '{"key": "value"} garbage';
    const expected = { key: "value" };
    expect(parseJSONStream(input)).toEqual(expected);
  });

  test("should return null for empty string", () => {
    const input = "";
    expect(parseJSONStream(input)).toBeNull();
  });

  test("should return null for completely invalid input", () => {
    const input = "not a json";
    expect(parseJSONStream(input)).toBeNull();
  });

  test("should salvage object with trailing comma", () => {
    const input = '{"a": 1,}';
    const expected = { a: 1 };
    expect(parseJSONStream(input)).toEqual(expected);
  });
});
