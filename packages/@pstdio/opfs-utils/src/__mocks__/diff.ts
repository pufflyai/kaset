export function applyPatch() {
  return "patched";
}

export function parsePatch(diff?: string) {
  // Keep existing behavior for the legacy test case with diff === "diff"
  if (diff === "diff") {
    return [{ oldFileName: "file.txt", newFileName: "file.txt", hunks: [] }];
  }

  // Simulate strict parser rejection for all real diffs; this forces tests
  // through the relaxed parser we implement in opfs-patch.ts
  throw new Error("parse error");
}
