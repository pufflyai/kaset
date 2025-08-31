export const SAMPLE_INDEX_TS = `// index.ts sample
export function hello(name: string) {
  return \`Hello, ${"${name}"}!\`;
}

export const meaning = 42;
`;

export const SAMPLE_UTIL_TS = `export const add = (a: number, b: number) => a + b;
export const todo = "TODO: replace this";
`;

export const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60">
  <rect width="120" height="60" fill="#1f2937"/>
  <text x="10" y="35" font-size="16" fill="#f7fee7">OPFS</text>
  Sorry, your browser does not support inline SVG.
</svg>`;

export const PATCH_MODIFY_INDEX = `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,7 +1,7 @@
// index.ts sample
export function hello(name: string) {
  return \`Hello, \${name}!\`;
}
 
-export const meaning = 42;
+export const meaning = 43;
`;

export const PATCH_CREATE_FILE = `--- /dev/null
+++ b/notes/added.txt
@@ -0,0 +1,3 @@
+This is a new file
+Created via patch
+Hello!
`;
