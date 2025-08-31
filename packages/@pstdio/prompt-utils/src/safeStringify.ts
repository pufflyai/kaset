import stringify from "json-stable-stringify";

/**
 * Enforce the same strings when stringifying an object.
 *
 * @param result
 * @returns
 */
export const safeStringify = (result: object) => {
  return (
    stringify(result, {
      replacer: (_key, value) => {
        if (typeof value === "bigint") return Number(value);

        if (typeof value === "string") {
          const sanitized = value.replaceAll('"', "");

          if (sanitized === "") return value;

          const numericalValue = Number(sanitized);

          if (!isNaN(numericalValue)) {
            return numericalValue;
          }
        }
        return value;
      },
    }) || ""
  );
};
