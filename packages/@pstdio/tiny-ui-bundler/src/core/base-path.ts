let basePath = "/";

const normalizePath = (path: string) => {
  if (!path) return "/";
  if (path === "/") return "/";
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
};

export const setBasePath = (path: string) => {
  basePath = normalizePath(path);
};

export const getBasePath = () => basePath;

export const resolveBasePath = (path: string) => {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  if (!normalized) return basePath;
  if (basePath === "/") return `/${normalized}`;
  return `${basePath}${normalized}`;
};

export const resetBasePath = () => {
  basePath = "/";
};
