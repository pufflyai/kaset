export function applyPatch() {
  return "patched";
}

export function parsePatch(_diff?: string) {
  return [{ oldFileName: "file.txt", newFileName: "file.txt", hunks: [] }];
}
