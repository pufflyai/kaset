import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { readFile, writeFile } from "@pstdio/opfs-utils";
import type { JSONSchema } from "../model/manifest";
import { joinPath, trimLeadingSlash } from "../utils/path";
import { clone } from "../utils/object";
import { SettingsValidationError, type SettingsValidationErrorDetail } from "./types";

const SETTINGS_ROOT = "state/public/plugins";

const toSettingsPath = (pluginId: string) => trimLeadingSlash(joinPath(SETTINGS_ROOT, `${pluginId}.json`));

const createAjv = () => {
  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  addFormats(ajv as any);
  return ajv;
};

const normalizeErrors = (errors: ValidateFunction["errors"] | null | undefined): SettingsValidationErrorDetail[] => {
  if (!errors?.length) return [];
  return errors.map((error) => ({
    message: error.message ?? "Invalid value",
    path:
      (typeof (error as any).instancePath === "string" && (error as any).instancePath) ||
      (typeof (error as any).dataPath === "string" && (error as any).dataPath) ||
      error.schemaPath ||
      "",
  }));
};

export class SettingsManager {
  private readonly ajv = createAjv();
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly defaults = new Map<string, unknown>();
  private readonly schemas = new Map<string, JSONSchema>();

  registerSchema(pluginId: string, schema?: JSONSchema): void {
    if (!schema) {
      this.validators.delete(pluginId);
      this.defaults.delete(pluginId);
      this.schemas.delete(pluginId);
      return;
    }
    const validate = this.ajv.compile(schema);
    const defaultsSource: Record<string, unknown> = {};
    const valid = validate(defaultsSource);
    if (valid) {
      this.defaults.set(pluginId, clone(defaultsSource));
    } else {
      this.defaults.delete(pluginId);
    }
    this.validators.set(pluginId, validate);
    this.schemas.set(pluginId, schema);
  }

  getSchema(pluginId: string): JSONSchema | undefined {
    return this.schemas.get(pluginId);
  }

  async read<T = unknown>(pluginId: string): Promise<T> {
    const validator = this.validators.get(pluginId);
    const path = toSettingsPath(pluginId);
    let payload: unknown;
    try {
      const raw = await readFile(path);
      payload = JSON.parse(raw);
    } catch (error: any) {
      if (error?.name !== "NotFoundError") {
        throw error;
      }
      payload = this.defaults.has(pluginId) ? clone(this.defaults.get(pluginId)) : {};
      return payload as T;
    }
    if (!validator) {
      return payload as T;
    }
    const data = clone(payload);
    const ok = validator(data);
    if (!ok) {
      throw new SettingsValidationError("Settings validation failed", normalizeErrors(validator.errors));
    }
    return data as T;
  }

  async write<T = unknown>(pluginId: string, value: T): Promise<void> {
    const validator = this.validators.get(pluginId);
    const path = toSettingsPath(pluginId);
    if (!validator) {
      const serialized = JSON.stringify(value, null, 2);
      await writeFile(path, serialized);
      return;
    }
    const data = clone(value);
    const ok = validator(data as any);
    if (!ok) {
      throw new SettingsValidationError("Settings validation failed", normalizeErrors(validator.errors));
    }
    const serialized = JSON.stringify(data, null, 2);
    await writeFile(path, serialized);
  }
}
