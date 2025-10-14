import Ajv from "ajv";
import { describe, expect, it, vi } from "vitest";

import type { ScopedFs } from "@pstdio/opfs-utils";

import { createSettingsAccessor } from "./settings";

describe("createSettingsAccessor", () => {
  it("applies schema defaults when the settings file is missing", async () => {
    const missingError = Object.assign(new Error("missing"), { code: "ENOENT" });
    const fs = {
      readJSON: vi.fn().mockRejectedValue(missingError),
      writeJSON: vi.fn(),
    } as unknown as ScopedFs;

    const ajv = new Ajv({ allErrors: true, useDefaults: true });
    const validator = ajv.compile({
      type: "object",
      properties: {
        theme: { type: "string", default: "light" },
      },
      required: ["theme"],
    });

    const settings = createSettingsAccessor(fs, "plugin.test", validator);

    await expect(settings.read<{ theme: string }>()).resolves.toEqual({ theme: "light" });
    expect(fs.readJSON).toHaveBeenCalledWith(".settings.json");
  });
});
