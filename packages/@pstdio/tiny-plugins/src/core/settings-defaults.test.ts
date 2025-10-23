import { describe, expect, it, vi } from "vitest";
import { deriveSettingsDefaults } from "./settings-defaults";

describe("deriveSettingsDefaults", () => {
  it("returns defaults derived from the schema", () => {
    const schema = {
      type: "object",
      properties: {
        theme: { type: "string", default: "dark" },
        preferences: {
          type: "object",
          default: {},
          properties: {
            count: { type: "number", default: 2 },
          },
        },
      },
      additionalProperties: false,
    };

    const defaults = deriveSettingsDefaults(schema) as {
      theme: string;
      preferences: { count: number };
    };

    expect(defaults).toEqual({ theme: "dark", preferences: { count: 2 } });

    defaults.preferences.count = 5;
    const next = deriveSettingsDefaults(schema) as { preferences: { count: number } };
    expect(next.preferences.count).toBe(2);
  });

  it("logs and returns an empty object when the schema is invalid", () => {
    const schema = {
      type: "object",
      properties: {
        invalid: { $ref: "#/definitions/missing" },
      },
    };

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const defaults = deriveSettingsDefaults(schema);

    expect(defaults).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns an empty object when the schema is not an object", () => {
    expect(deriveSettingsDefaults(undefined)).toEqual({});
    expect(deriveSettingsDefaults(null)).toEqual({});
  });
});
