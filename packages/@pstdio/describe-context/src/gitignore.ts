import { readFile } from "fs/promises";
import { resolve, dirname, join, relative, basename } from "path";

export interface GitignoreRule {
  pattern: string;
  isNegation: boolean;
  isDirectoryOnly: boolean;
  regex: RegExp;
}

export interface GitignoreContext {
  rules: GitignoreRule[];
  gitignoreFiles: string[];
}

/**
 * Parse a gitignore pattern into a regex
 */
function parseGitignorePattern(pattern: string): RegExp {
  // Escape special regex characters except for * and ?
  let regexPattern = pattern.replace(/[+^${}()|[\]\\]/g, '\\$&');
  
  // Handle gitignore glob patterns
  regexPattern = regexPattern
    .replace(/\*\*/g, '.*')      // ** matches any characters including /
    .replace(/\*/g, '[^/]*')     // * matches any characters except /
    .replace(/\?/g, '[^/]');     // ? matches any single character except /

  // Anchor the pattern
  regexPattern = '^' + regexPattern + '$';
  
  return new RegExp(regexPattern);
}

/**
 * Parse a .gitignore file content into rules
 */
export function parseGitignore(content: string): GitignoreRule[] {
  const lines = content.split('\n');
  const rules: GitignoreRule[] = [];

  for (let line of lines) {
    line = line.trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    const isNegation = line.startsWith('!');
    if (isNegation) {
      line = line.slice(1);
    }

    const isDirectoryOnly = line.endsWith('/');
    if (isDirectoryOnly) {
      line = line.slice(0, -1);
    }

    // Skip empty patterns after processing
    if (!line) continue;

    try {
      const regex = parseGitignorePattern(line);
      rules.push({
        pattern: line,
        isNegation,
        isDirectoryOnly,
        regex,
      });
    } catch (error) {
      // Skip invalid regex patterns
      console.warn(`Invalid gitignore pattern: ${line}`, error);
    }
  }

  return rules;
}

/**
 * Load gitignore files from a directory and its parent directories
 */
export async function loadGitignoreContext(targetDir: string): Promise<GitignoreContext> {
  const rules: GitignoreRule[] = [];
  const gitignoreFiles: string[] = [];
  
  let currentDir = resolve(targetDir);
  const rootDir = resolve('/');
  
  // Walk up the directory tree looking for .gitignore files
  while (currentDir !== rootDir) {
    const gitignorePath = join(currentDir, '.gitignore');
    
    try {
      const content = await readFile(gitignorePath, 'utf-8');
      const dirRules = parseGitignore(content);
      
      // Add relative path context to rules from parent directories
      const relativePath = relative(targetDir, currentDir);
      
      for (const rule of dirRules) {
        if (currentDir === resolve(targetDir)) {
          // Rules from the target directory apply directly
          rules.push(rule);
        } else {
          // Rules from parent directories need path prefix
          const prefixedPattern = relativePath ? `${relativePath}/${rule.pattern}` : rule.pattern;
          rules.push({
            ...rule,
            pattern: prefixedPattern,
            regex: parseGitignorePattern(prefixedPattern),
          });
        }
      }
      
      gitignoreFiles.push(gitignorePath);
    } catch {
      // .gitignore file doesn't exist or can't be read, continue
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break; // reached root
    currentDir = parentDir;
  }
  
  return { rules, gitignoreFiles };
}

/**
 * Check if a file path matches gitignore rules
 * Returns: true if ignored, false if explicitly not ignored, null if no rules apply
 */
export function checkGitignoreMatch(
  filePath: string,
  isDirectory: boolean,
  rules: GitignoreRule[]
): boolean | null {
  let isIgnored: boolean | null = null;
  let hasMatchingRules = false;
  
  // Test against all rules, with negation rules potentially overriding ignores
  for (const rule of rules) {
    // Skip directory-only rules for files
    if (rule.isDirectoryOnly && !isDirectory) {
      continue;
    }
    
    const matches = rule.regex.test(filePath) || rule.regex.test(basename(filePath));
    
    if (matches) {
      hasMatchingRules = true;
      if (rule.isNegation) {
        isIgnored = false; // negation rule overrides previous ignores
      } else {
        isIgnored = true; // normal ignore rule
      }
    }
  }
  
  return hasMatchingRules ? isIgnored : null;
}

/**
 * Check if a file path matches gitignore rules (legacy compatibility)
 */
export function isIgnoredByGitignore(
  filePath: string,
  isDirectory: boolean,
  rules: GitignoreRule[]
): boolean {
  const result = checkGitignoreMatch(filePath, isDirectory, rules);
  return result === true;
}