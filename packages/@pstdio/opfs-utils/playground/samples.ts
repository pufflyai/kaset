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

export const SAMPLE_TODOS_SATURDAY = `# saturday

- [ ] Wake up at dawn (Quest Start): Gain 1 XP and collect the Morning Brew from the Kitchen Shrine.
- [ ] Equip Adventuring Gear: Lay out outfit and pack small backpack with essentials (+1 Stamina).
- [ ] Complete Daily Training (30 min): Stretch, cardio, or yoga to boost agility.
- [ ] Gather Supplies (Errand): Visit market to restock rations and potions (groceries).
- [ ] Main Quest — Creative Mission (2 hrs): Work on a passion project or hobby to earn Inspiration.
`;

export const PATCH_MODIFY_INDEX = `--- a/src/index.ts
+++ b/src/index.ts
@@ -2,5 +2,5 @@
 export function hello(name: string) {
   return \`Hello, \${name}!\`;
 }
 
-export const meaning = 42;
+export const meaning = 41;`;

export const PATCH_CREATE_FILE = `--- /dev/null
+++ b/notes/added.txt
@@ -0,0 +1,3 @@
+This is a new file
+Created via patch
+Hello!
`;

export const PATCH_MULTI_FILE = `--- a/src/index.ts
+++ b/src/index.ts
@@ -2,5 +2,5 @@
 export function hello(name: string) {
   return \`Hello, \${name}!\`;
 }
 
-export const meaning = 42;
+export const meaning = 41;

--- a/src/util.ts
+++ b/src/util.ts
@@ -1,2 +1,2 @@
 export const add = (a: number, b: number) => a + b;
-export const todo = "TODO: replace this";
+export const todo = "done";

--- /dev/null
+++ b/notes/added.txt
@@ -0,0 +1,3 @@
+This is a new file
+Created via patch
+Hello!

--- a/docs/notes.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-Notes about the project.
-TODO: add more examples.
`;

// Numberless hunk header variant to demonstrate patches without explicit line numbers
export const PATCH_MODIFY_INDEX_NO_LINES = `--- a/src/index.ts
+++ b/src/index.ts
@@
 export function hello(name: string) {
   return \`Hello, \${name}!\`;
 }
 
-export const meaning = 42;
+export const meaning = 41;`;

// Multi-line patch with non-consecutive changes in a single hunk (no line numbers)
export const PATCH_TODOS_SATURDAY_NON_CONSECUTIVE = `--- a/todos/saturday.md
+++ b/todos/saturday.md
@@
 # saturday
 
 - [ ] Wake up at dawn (Quest Start): Gain 1 XP and collect the Morning Brew from the Kitchen Shrine.
-- [ ] Equip Adventuring Gear: Lay out outfit and pack small backpack with essentials (+1 Stamina).
+- [x] Equip Adventuring Gear: Lay out outfit and pack small backpack with essentials (+1 Stamina).
 - [ ] Complete Daily Training (30 min): Stretch, cardio, or yoga to boost agility.
-- [ ] Gather Supplies (Errand): Visit market to restock rations and potions (groceries).
+- [x] Gather Supplies (Errand): Visit market to restock rations and potions (groceries).
 - [ ] Main Quest — Creative Mission (2 hrs): Work on a passion project or hobby to earn Inspiration.
`;
