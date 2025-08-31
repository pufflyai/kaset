import { describe, expect, test } from "vitest";
import { getSchema } from "./getSchema";

describe("getSchema", () => {
  test("handles primitive types", () => {
    expect(getSchema("hello")).toEqual({ type: "string" });
    expect(getSchema(42)).toEqual({ type: "number" });
    expect(getSchema(true)).toEqual({ type: "boolean" });
    expect(getSchema(null)).toEqual({ type: "null" });
  });

  test("handles arrays", () => {
    expect(getSchema([1, 2, 3])).toEqual({
      type: "array",
      items: { type: "number" },
    });

    expect(getSchema([])).toEqual({
      type: "array",
      items: { type: "any" },
    });
  });

  test("handles objects", () => {
    const input = {
      name: "John",
      age: 30,
      isActive: true,
    };

    expect(getSchema(input)).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        isActive: { type: "boolean" },
      },
    });
  });

  test("handles nested structures", () => {
    const input = {
      user: {
        name: "John",
        contacts: [{ email: "john@example.com" }],
      },
    };

    expect(getSchema(input)).toEqual({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            contacts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  email: { type: "string" },
                },
              },
            },
          },
        },
      },
    });
  });

  test("handles array of objects", () => {
    const input = [
      {
        id: 1,
        name: "Item 1",
        tags: ["a", "b"],
      },
      {
        id: 2,
        name: "Item 2",
        tags: ["c", "d"],
      },
    ];

    expect(getSchema(input)).toEqual({
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    });
  });
});
