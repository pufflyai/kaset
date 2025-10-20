import Ajv from "ajv";
import { valid } from "semver";
import type { Manifest } from "./types";

export type ManifestResult =
  | { ok: true; manifest: Manifest; warnings: string[] }
  | { ok: false; error: string; details?: unknown; warnings: string[] };

const schema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: true, // allow future growth but enforce required core fields
  required: ["id", "name", "version", "api", "entry"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    api: { type: "string", minLength: 1 },
    entry: { type: "string", minLength: 1 },
    description: { type: "string" },
    dependencies: {
      type: "object",
      propertyNames: { type: "string", minLength: 1 },
      additionalProperties: { type: "string", minLength: 1 },
    },
    ui: {},
    commands: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "title"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          category: { type: "string" },
          when: { type: "string" },
          parameters: {},
          timeoutMs: { type: "number" },
        },
      },
    },
    settingsSchema: {},
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const API_VERSION_PATTERN = /^v[0-9]+$/;

function normalizeApiVersion(value: string): string | null {
  const normalized = value.trim();
  if (!API_VERSION_PATTERN.test(normalized)) return null;
  return normalized;
}

export async function readManifestStrict(
  readText: (path: string) => Promise<string>,
  expectedPluginId: string,
  hostApiVersion: string,
): Promise<ManifestResult> {
  const warnings: string[] = [];
  let text = "";

  try {
    text = await readText("manifest.json");
  } catch (e) {
    return { ok: false, error: `manifest.json not found: ${(e as Error).message}`, warnings };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `manifest.json is not valid JSON: ${(e as Error).message}`, warnings };
  }

  const validShape = validate(raw);
  if (!validShape) {
    return { ok: false, error: "manifest schema validation failed", details: validate.errors, warnings };
  }

  const m = raw as Manifest;

  // id must match directory name
  if (m.id !== expectedPluginId) {
    return { ok: false, error: `manifest.id "${m.id}" does not match directory name "${expectedPluginId}"`, warnings };
  }

  // version must be valid semver
  if (!valid(m.version, { loose: true })) {
    return { ok: false, error: `manifest.version "${m.version}" is not a valid semver`, warnings };
  }

  const normalizedPluginApi = normalizeApiVersion(m.api);
  if (!normalizedPluginApi) {
    return {
      ok: false,
      error: `manifest.api "${m.api}" must match pattern "v<number>"`,
      warnings,
    };
  }

  const normalizedHostApi = normalizeApiVersion(hostApiVersion);
  if (!normalizedHostApi) {
    return {
      ok: false,
      error: `host API version "${hostApiVersion}" is invalid`,
      warnings,
    };
  }

  if (normalizedPluginApi !== normalizedHostApi) {
    return {
      ok: false,
      error: `manifest.api "${m.api}" is incompatible with host API ${hostApiVersion}`,
      warnings,
    };
  }

  // light, non-fatal nits
  if (!m.entry.endsWith(".js") && !m.entry.endsWith(".mjs") && !m.entry.endsWith(".ts")) {
    warnings.push(`"entry" does not look like a module file: ${m.entry}`);
  }

  return { ok: true, manifest: m, warnings };
}
