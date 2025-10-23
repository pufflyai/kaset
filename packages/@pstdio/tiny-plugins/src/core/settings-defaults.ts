import Ajv from "ajv";

function cloneDefaults<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deriveSettingsDefaults(schema: unknown): Record<string, unknown> | undefined {
  if (schema === null || (typeof schema !== "object" && typeof schema !== "boolean")) {
    console.warn("[tiny-plugins] settings defaults seeding skipped: invalid schema", schema);
    return undefined;
  }

  try {
    const ajv = new Ajv({ useDefaults: true, strict: false, allErrors: true, removeAdditional: false });
    const validate = ajv.compile(schema as object);
    const target: Record<string, unknown> = {};
    const valid = validate(target);
    if (valid === false) {
      console.warn("[tiny-plugins] settings defaults seeding skipped: schema validation failed", validate.errors);
      return undefined;
    }
    return cloneDefaults(target);
  } catch (error) {
    console.warn("[tiny-plugins] settings defaults seeding skipped: schema error", error);
    return undefined;
  }
}
