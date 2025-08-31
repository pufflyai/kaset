/**
 * Attempts to parse a possibly incomplete JSON stream.
 * It does so by iterating over progressively shorter prefixes,
 * and (if the JSON is expected to be an object or array)
 * appending the number of needed closing characters based on a simple brace count.
 *
 * @param input The JSON stream as a string.
 * @returns The parsed JSON value if a salvageable valid JSON is found; otherwise null.
 */
export function parseJSONStream(input: string): any | null {
  input = input.trim();
  if (input.length === 0) {
    return null;
  }

  // If the full input parses, return it.
  try {
    return JSON.parse(input);
  } catch {
    // fall through
  }

  const firstChar = input[0];
  const closingChar = firstChar === "{" ? "}" : firstChar === "[" ? "]" : "";

  // Helper: counts unmatched occurrences of an opening character.
  // This very simple algorithm ignores complexities of numbers and booleans but works for our use.
  function countUnmatched(s: string, open: string, close: string): number {
    let count = 0;
    let inString = false;
    let escape = false;
    for (const char of s) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === open) {
          count++;
        } else if (char === close) {
          count--;
        }
      }
    }
    return count > 0 ? count : 0;
  }

  // We'll try to salvage a valid JSON value by considering progressively shorter prefixes.
  // We start at input.length - 1 to avoid immediately using the full (incomplete) input.
  const maxAppend = 10;
  for (let i = input.length - 1; i > 0; i--) {
    const prefix = input.substring(0, i).trim();

    // First, try parsing the prefix as-is.
    try {
      return JSON.parse(prefix);
    } catch {
      // not valid on its own, so if we expect an object/array, try to auto-close it
    }

    if (closingChar) {
      // Compute how many closing characters are missing.
      const unmatched = countUnmatched(prefix, firstChar, closingChar);
      // Try appending exactly the number of unmatched closing characters.
      if (unmatched > 0 && unmatched <= maxAppend) {
        const candidate = prefix + closingChar.repeat(unmatched);
        try {
          return JSON.parse(candidate);
        } catch {
          // fall through to trying extra closings if needed
        }
      }
      // In case our simple count was off, try appending from unmatched+1 up to maxAppend.
      for (let j = unmatched + 1; j <= maxAppend; j++) {
        const candidate = prefix + closingChar.repeat(j);
        try {
          return JSON.parse(candidate);
        } catch {
          // try next
        }
      }
    }
  }
  return null;
}
