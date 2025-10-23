import Ajv from "ajv";

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value ?? null));
}

function inferInitialValue(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return {};
  const typed = schema as { type?: string | string[]; default?: unknown };
  if (typed.default !== undefined) return cloneValue(typed.default);
  const type = typed.type;
  if (Array.isArray(type)) {
    if (type.includes("object")) return {};
    if (type.includes("array")) return [];
    return {};
  }
  if (type === "array") return [];
  if (type === "object") return {};
  return {};
}

export function deriveSettingsDefaults(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return {};

  try {
    const ajv = new Ajv({ strict: false, useDefaults: true, coerceTypes: false });
    const validate = ajv.compile(schema as Record<string, unknown>);
    const defaults = cloneValue(inferInitialValue(schema));
    const valid = validate(defaults);
    if (!valid) {
      console.warn("[tiny-plugins] failed to derive settings defaults", validate.errors);
      return {};
    }
    return cloneValue(defaults);
  } catch (error) {
    console.warn("[tiny-plugins] failed to derive settings defaults", error);
    return {};
  }
}
