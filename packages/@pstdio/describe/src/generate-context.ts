#!/usr/bin/env node

/**
 * LLM Context Generator (CLI wrapper)
 *
 * Converts the reusable library in core.ts to a simple CLI.
 */

import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { basename } from "path";
import { fileURLToPath } from "url";
import { generateContext } from "./core";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node dist/generate-context.js <folder-path> [output-file]");
    process.exit(1);
  }

  const folderPath = args[0];
  const outputFile = args[1] || `${basename(folderPath)}-context.md`;

  if (!existsSync(folderPath)) {
    console.error(`Error: Folder "${folderPath}" does not exist`);
    process.exit(1);
  }

  console.log(`Analyzing folder: ${folderPath}`);
  console.log(`Output file: ${outputFile}`);

  const { markdown, stats } = await generateContext(folderPath);

  await writeFile(outputFile, markdown);

  console.log(`✅ Context file generated: ${outputFile}`);
  console.log(`📊 File size: ${Math.round(stats.size / 1024)}KB`);
  console.log(
    `🔢 Estimated tokens: ${stats.estimatedTokens.toLocaleString()} (~${Math.round(stats.estimatedTokens / 1000)}k)`,
  );

  // Provide context about token limits
  if (stats.estimatedTokens > 128000) {
    console.log(`⚠️  Warning: File exceeds typical LLM context limits (128k tokens)`);
  } else if (stats.estimatedTokens > 32000) {
    console.log(`⚠️  Note: File is large, may approach some LLM context limits`);
  } else {
    console.log(`✅ File size is within typical LLM context limits`);
  }
}

// Run the script
const isMain = typeof process !== "undefined" && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch(console.error);
