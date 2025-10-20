type ReplacementMap = Record<string, string>;

export const applyReplacements = (source: string, replacements: ReplacementMap) => {
  let result = source;

  for (const [token, value] of Object.entries(replacements)) {
    result = result.replaceAll(token, value);
  }

  return result;
};
