import * as ts from 'typescript';
import { existsSync } from 'fs';

/**
 * Resolve module specifier using TypeScript's official resolver.
 * Used when ts-morph can't resolve (target not in project).
 *
 * v2.2 Changes:
 * - Receives compilerOptions from cache (not reads tsconfig)
 * - Only accepts .ts / .tsx files
 * - Skips .d.ts (type declarations not analyzed for boundary)
 * - Skips .json and other non-TS extensions
 *
 * @param moduleSpecifier - The import path (e.g., '@/domain/user')
 * @param containingFile - Absolute path of the importing file
 * @param compilerOptions - Pre-parsed compilerOptions from cache
 * @returns Resolved absolute file path, or null if unresolvable/filtered
 */
export function resolveModulePath(
  moduleSpecifier: string,
  containingFile: string,
  compilerOptions: ts.CompilerOptions
): string | null {
  try {
    const result = ts.resolveModuleName(
      moduleSpecifier,
      containingFile,
      compilerOptions,
      ts.sys
    );

    const resolved = result.resolvedModule?.resolvedFileName;
    if (!resolved) return null;

    // Extension filtering (order matters!)
    // 1. Skip .d.ts FIRST (before .ts check, since .d.ts ends with .ts)
    if (resolved.endsWith('.d.ts')) {
      return null;
    }

    // 2. Only accept .ts and .tsx files
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
      return null; // Skip .json, .js, etc.
    }

    // 3. Skip node_modules
    if (resolved.includes('node_modules')) {
      return null;
    }

    // 4. Verify file exists
    if (!existsSync(resolved)) {
      return null;
    }

    return resolved;
  } catch {
    return null;
  }
}
