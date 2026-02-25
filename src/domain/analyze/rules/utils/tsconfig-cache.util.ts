import * as ts from 'typescript';
import * as path from 'path';

/**
 * Cached tsconfig parsing result.
 */
export interface ParsedTsconfig {
  compilerOptions: ts.CompilerOptions;
  baseDir: string;
}

/**
 * Parse tsconfig.json and return compilerOptions.
 * Results should be cached externally by tsconfigPath.
 */
export function parseTsconfig(tsconfigPath: string): ParsedTsconfig | null {
  try {
    // Use ts.sys.readFile (standard TypeScript file reader)
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) return null;

    const baseDir = path.dirname(tsconfigPath);
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      baseDir
    );

    return {
      compilerOptions: parsed.options,
      baseDir,
    };
  } catch {
    return null;
  }
}
