import micromatch from "micromatch";
import type { Manifest, Permissions } from "../model/manifest";
import { ensureLeadingSlash } from "../utils/path";

const PROTECTED_PATHS = ["/state/secure/**"];

export interface PermissionChecker {
  assertRead(path: string): void;
  assertWrite(path: string): void;
  canRead(path: string): boolean;
  canWrite(path: string): boolean;
  assertNet(url: string): void;
  canUseNet(url: string): boolean;
}

interface NetRule {
  protocols?: string[];
  hostPattern: string;
  port?: string;
}

const normalizePath = (value: string) => ensureLeadingSlash(value.replace(/\\/g, "/"));

const matchAny = (path: string, patterns: string[] | undefined) => {
  if (!patterns?.length) return false;
  return micromatch.isMatch(path, patterns, { dot: true, nocase: false });
};

const buildNetRules = (permissions: Permissions | undefined): NetRule[] => {
  const entries = permissions?.net ?? [];
  return entries.map((entry) => {
    if (!entry.includes("://")) {
      return { hostPattern: entry };
    }
    try {
      const url = new URL(entry);
      const protocol = url.protocol.replace(/:$/, "");
      return {
        hostPattern: url.hostname || entry,
        port: url.port || undefined,
        protocols: protocol ? [protocol] : undefined,
      };
    } catch {
      const [proto, rest] = entry.split("://");
      return {
        hostPattern: rest ?? entry,
        protocols: proto ? [proto] : undefined,
      };
    }
  });
};

const pathDenied = (path: string) => matchAny(path, PROTECTED_PATHS);

export const createPermissionChecker = (manifest: Manifest): PermissionChecker => {
  const fsPermissions = manifest.permissions?.fs;
  const netRules = buildNetRules(manifest.permissions);

  const canRead = (input: string) => {
    const path = normalizePath(input);
    if (pathDenied(path)) return false;
    return matchAny(path, fsPermissions?.read);
  };

  const canWrite = (input: string) => {
    const path = normalizePath(input);
    if (pathDenied(path)) return false;
    return matchAny(path, fsPermissions?.write);
  };

  const assertRead = (path: string) => {
    if (!canRead(path)) {
      throw new Error(`FS read denied: ${normalizePath(path)}`);
    }
  };

  const assertWrite = (path: string) => {
    if (!canWrite(path)) {
      throw new Error(`FS write denied: ${normalizePath(path)}`);
    }
  };

  const canUseNet = (urlStr: string) => {
    if (!netRules.length) return false;
    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      return false;
    }
    const protocol = url.protocol.replace(/:$/, "");
    const host = url.hostname;
    const port = url.port || undefined;
    return netRules.some((rule) => {
      if (rule.protocols && !rule.protocols.includes(protocol)) return false;
      if (rule.port && rule.port !== port) return false;
      return micromatch.isMatch(host, rule.hostPattern, { nocase: true });
    });
  };

  const assertNet = (url: string) => {
    if (!canUseNet(url)) {
      throw new Error(`Network access denied: ${url}`);
    }
  };

  return { assertRead, assertWrite, canRead, canWrite, assertNet, canUseNet };
};
