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
  } else if (typeof input === "object" && input !== null) {
    const properties: { [key: string]: Schema } = {};
    for (const key in input) {
      // eslint-disable-next-line no-prototype-builtins
      if (input.hasOwnProperty(key)) {
        properties[key] = getSchema(input[key]);
      }
    }
    return {
      type: "object",
      properties,
    };
  } else if (typeof input === "string") {
    return { type: "string" };
  } else if (typeof input === "number") {
    return { type: "number" };
  } else if (typeof input === "boolean") {
    return { type: "boolean" };
  } else if (input === null) {
    return { type: "null" };
  } else {
    return { type: "any" };
  }
}
