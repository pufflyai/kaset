type Schema = {
  type: string;
  properties?: {
    [key: string]: Schema;
  };
  items?: Schema;
};

/**
 * Convert any js object to a JSON schema
 *
 * @param input
 * @returns
 */
export function getSchema(input: any): Schema {
  if (Array.isArray(input)) {
    const itemSchema = input.length > 0 ? getSchema(input[0]) : { type: "any" };
    return {
      type: "array",
      items: itemSchema,
    };
  }
  if (typeof input === "object" && input !== null) {
    const properties: { [key: string]: Schema } = {};
    for (const key in input) {
      // eslint-disable-next-line no-prototype-builtins
      if (Object.hasOwn(input, key)) {
        properties[key] = getSchema(input[key]);
      }
    }
    return {
      type: "object",
      properties,
    };
  }
  if (typeof input === "string") {
    return { type: "string" };
  }
  if (typeof input === "number") {
    return { type: "number" };
  }
  if (typeof input === "boolean") {
    return { type: "boolean" };
  }
  if (input === null) {
    return { type: "null" };
  }
  return { type: "any" };
}
