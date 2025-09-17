const split = (value: string) => value.split("/").filter(Boolean);

export const joinPath = (...parts: Array<string | undefined>): string => {
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    tokens.push(...split(part));
  }
  return tokens.join("/");
};

export const trimLeadingSlash = (value: string): string => value.replace(/^\/+/, "");

export const ensureLeadingSlash = (value: string): string =>
  value.startsWith("/") ? value : value ? `/${value}` : "/";

export const withTrailingSlash = (value: string): string => (value.endsWith("/") ? value : `${value}/`);
