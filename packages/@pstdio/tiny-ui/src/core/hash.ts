import type { Lockfile } from "./import-map";

export interface HashInput {
  id: string;
  root: string;
  entryRelativePath: string;
  digests: Record<string, string>;
  tsconfig?: string | null;
  lockfile?: Lockfile | null;
}

const sortRecord = (record: Record<string, string>) =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

const textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

const hexFromBuffer = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const hashWithSubtle = async (payload: string) => {
  if (!textEncoder || typeof crypto === "undefined" || !("subtle" in crypto)) return null;
  const encoded = textEncoder.encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return hexFromBuffer(digest);
};

const fnv1a64 = (payload: string) => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < payload.length; index += 1) {
    hash ^= BigInt(payload.charCodeAt(index));
    hash *= prime;
    hash &= 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, "0");
};

export const hashText = async (payload: string): Promise<string> => {
  const subtleHash = await hashWithSubtle(payload);
  if (typeof subtleHash === "string") return subtleHash;

  return fnv1a64(payload);
};

export const computeLockfileHash = async (lockfile: Lockfile | null | undefined): Promise<string> => {
  if (!lockfile) return "none";
  const normalizedLockfile = sortRecord(lockfile);
  const serialized = JSON.stringify(normalizedLockfile);
  return hashText(serialized);
};

export const computeHash = async (input: HashInput): Promise<string> => {
  const normalizedDigests = sortRecord(input.digests);
  const normalizedLockfile = input.lockfile ? sortRecord(input.lockfile) : null;

  const payload = {
    id: input.id,
    root: input.root,
    entryRelativePath: input.entryRelativePath,
    digests: normalizedDigests,
    tsconfig: input.tsconfig ?? null,
    lockfile: normalizedLockfile,
  };

  const serialized = JSON.stringify(payload);
  return hashText(serialized);
};
