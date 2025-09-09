import { readdir, readFile, stat } from "fs/promises";
import { basename, extname, join, relative } from "path";
import { loadGitignoreContext, checkGitignoreMatch, type GitignoreContext } from "./gitignore";

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
  extension: string;
  content?: string;
  isRelevant: boolean;
  reason?: string;
}

const RELEVANT_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".tsx",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".php",
  ".cs",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".vue",
  ".svelte",
  ".astro",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".md",
  ".mdx",
  ".txt",
  ".rst",
  ".sql",
  ".graphql",
  ".gql",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".dockerfile",
  ".dockerignore",
  ".env",
  ".env.example",
  ".env.local",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".tsconfig",
  ".babelrc",
  ".swcrc",
]);

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  "dist",
  "build",
  ".vscode",
  ".idea",
  "__pycache__",
  ".pytest_cache",
  "coverage",
  ".coverage",
  ".nyc_output",
  "vendor",
  "tmp",
  "temp",
  ".tmp",
  ".temp",
  "logs",
  "log",
  ".DS_Store",
  ".storybook",
]);

const SKIP_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  "npm-debug.log",
  "yarn-error.log",
  "yarn-debug.log",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
]);

const SKIP_PATTERNS = [
  /\.lock$/,
  /\.log$/,
  /\.cache$/,
  /\.pid$/,
  /\.swp$/,
  /\.swo$/,
  /~$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.d\.ts$/,
];

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB

export function shouldSkipFile(fileName: string, size: number, relativePath?: string, gitignoreContext?: GitignoreContext): boolean {
  if (size > MAX_FILE_SIZE) return true;

  // Check if gitignore has explicit rules for this file
  let gitignoreDecision: boolean | null = null;
  if (gitignoreContext && relativePath) {
    gitignoreDecision = checkGitignoreMatch(relativePath, false, gitignoreContext.rules);
  }

  // Check hardcoded skip patterns
  const hardcodedSkip = SKIP_FILES.has(fileName) || SKIP_PATTERNS.some((pattern) => pattern.test(fileName));

  // If gitignore explicitly says not to ignore (e.g., negation pattern), respect that
  if (gitignoreDecision === false) {
    return false;
  }

  // If gitignore explicitly says to ignore, respect that
  if (gitignoreDecision === true) {
    return true;
  }

  // If gitignore has no opinion, use hardcoded patterns
  return hardcodedSkip;
}

export function shouldSkipDirectory(dirName: string, relativePath?: string, gitignoreContext?: GitignoreContext): boolean {
  // Check if gitignore has explicit rules for this directory
  let gitignoreDecision: boolean | null = null;
  if (gitignoreContext && relativePath) {
    gitignoreDecision = checkGitignoreMatch(relativePath, true, gitignoreContext.rules);
  }

  // Check hardcoded skip directories
  const hardcodedSkip = SKIP_DIRECTORIES.has(dirName);

  // If gitignore explicitly says not to ignore (e.g., negation pattern), respect that
  if (gitignoreDecision === false) {
    return false;
  }

  // If gitignore explicitly says to ignore, respect that
  if (gitignoreDecision === true) {
    return true;
  }

  // If gitignore has no opinion, use hardcoded patterns
  return hardcodedSkip;
}

export function isRelevantFile(filePath: string, extension: string, size: number): boolean {
  const fileName = basename(filePath);

  const configFiles = [
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".gitignore",
    ".npmignore",
    ".dockerignore",
    "Makefile",
    "makefile",
  ];

  if (configFiles.includes(fileName)) return true;
  if (RELEVANT_EXTENSIONS.has(extension)) return true;
  if (!extension && size < 10000) return true;
  return false;
}

export async function analyzeFile(filePath: string, rootPath: string, gitignoreContext?: GitignoreContext): Promise<FileInfo> {
  const stats = await stat(filePath);
  const relativePath = relative(rootPath, filePath);
  const extension = extname(filePath).toLowerCase();
  const fileName = basename(filePath);

  const info: FileInfo = {
    path: filePath,
    relativePath,
    size: stats.size,
    isDirectory: stats.isDirectory(),
    extension,
    isRelevant: false,
  };

  if (info.isDirectory) {
    info.isRelevant = !shouldSkipDirectory(fileName, relativePath, gitignoreContext);
    if (!info.isRelevant) info.reason = `Skipped directory: ${fileName}`;
    return info;
  }

  if (shouldSkipFile(fileName, stats.size, relativePath, gitignoreContext)) {
    info.reason = `Skipped: ${stats.size > MAX_FILE_SIZE ? "too large" : "ignored file type or gitignore"}`;
    info.isRelevant = false;
    return info;
  }

  info.isRelevant = isRelevantFile(filePath, extension, stats.size);

  if (info.isRelevant) {
    try {
      const content = await readFile(filePath, "utf-8");
      if (content.includes("\0")) {
        info.isRelevant = false;
        info.reason = "Binary file detected";
      } else {
        info.content = content;
      }
    } catch (error) {
      info.isRelevant = false;
      info.reason = `Error reading file: ${error}`;
    }
  } else {
    info.reason = "Not a relevant file type";
  }

  return info;
}

export async function analyzeDirectory(dirPath: string, rootPath: string, gitignoreContext?: GitignoreContext): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  try {
    const entries = await readdir(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const info = await analyzeFile(fullPath, rootPath, gitignoreContext);
      files.push(info);
      if (info.isDirectory && info.isRelevant) {
        const subFiles = await analyzeDirectory(fullPath, rootPath, gitignoreContext);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dirPath}: ${error}`);
  }
  return files;
}

export function generateDirectoryTree(files: FileInfo[], rootPath: string): string {
  const relevantFiles = files.filter((f) => f.isRelevant);
  const tree: string[] = ["## Directory Structure", ""];

  const dirs = new Map<string, FileInfo[]>();
  for (const file of relevantFiles) {
    const dir = file.isDirectory ? file.relativePath : relative(rootPath, join(file.path, ".."));
    if (!dirs.has(dir)) dirs.set(dir, []);
    if (!file.isDirectory) dirs.get(dir)!.push(file);
  }

  const sortedDirs = Array.from(dirs.keys()).sort();
  tree.push("```");
  for (const dir of sortedDirs) {
    tree.push(dir === "." ? "Root:" : `${dir}/`);
    const dirFiles = dirs.get(dir)!;
    for (const file of dirFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      tree.push(`  ${basename(file.relativePath)}`);
    }
    tree.push("");
  }
  tree.push("```");
  tree.push("");
  return tree.join("\n");
}

export function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".py": "python",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".sh": "bash",
    ".bash": "bash",
    ".dockerfile": "dockerfile",
  };
  return langMap[ext.toLowerCase()] || "";
}

export function generateFileContent(files: FileInfo[]): string {
  const relevantFiles = files.filter((f) => f.isRelevant && !f.isDirectory && f.content);
  const sections: string[] = ["## File Contents", ""];

  let totalSize = 0;
  for (const file of relevantFiles) {
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      sections.push(
        `\n*Note: Remaining files skipped due to size limit (${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)}MB)*\n`,
      );
      break;
    }

    totalSize += file.size;
    sections.push(`> ### 📄 \`${file.relativePath}\``);
    sections.push("");

    if (file.extension === ".md" || file.extension === ".txt") {
      sections.push(file.content!);
    } else {
      sections.push(`\`\`\`${getLanguageFromExtension(file.extension)}`);
      sections.push(file.content!);
      sections.push("```");
    }

    sections.push("");
  }

  return sections.join("\n");
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function generateContext(folderPath: string) {
  // Load gitignore context before analyzing directory
  const gitignoreContext = await loadGitignoreContext(folderPath);
  
  const files = await analyzeDirectory(folderPath, folderPath, gitignoreContext);
  const markdown = [generateDirectoryTree(files, folderPath), generateFileContent(files)].join("\n");
  const estimatedTokens = estimateTokenCount(markdown);

  return {
    markdown,
    files,
    gitignoreContext,
    stats: {
      total: files.length,
      relevant: files.filter((f) => f.isRelevant && !f.isDirectory).length,
      estimatedTokens,
      size: markdown.length,
    },
  } as const;
}
