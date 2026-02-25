import {
  Project,
  SourceFile,
  ImportDeclaration,
  ExportDeclaration,
} from 'ts-morph';
import { minimatch } from 'minimatch';
import { existsSync } from 'fs';
import * as path from 'path';
import { posix } from 'path';
import { AnalyzeContext, Finding, Rule } from '../rule.types';
import {
  AiDebtConfig,
  BoundaryRuleConfig,
  LayerConfig,
} from '../../config/config.types';
import { findNearestTsconfig } from '../utils/find-tsconfig.util';
import { toPosixPath } from '../utils/normalize-path.util';
import { parseTsconfig, ParsedTsconfig } from '../utils/tsconfig-cache.util';
import { resolveModulePath } from '../utils/resolve-module.util';

/**
 * Match a file path to a layer based on glob patterns.
 * Uses path.relative for safe cross-platform normalization.
 */
function matchLayer(
  absoluteFilePath: string,
  cwd: string,
  layers: LayerConfig[]
): string | null {
  // Use toPosixPath for safe cross-platform normalization
  const relativePath = posix.normalize(
    toPosixPath(path.relative(cwd, absoluteFilePath))
  );

  for (const layer of layers) {
    for (const pattern of layer.match) {
      if (minimatch(relativePath, pattern)) {
        return layer.name;
      }
    }
  }
  return null;
}

/**
 * Find a matching rule that forbids the import.
 */
function findMatchingRule(
  fromLayer: string,
  toLayer: string,
  rules: BoundaryRuleConfig[]
): BoundaryRuleConfig | null {
  return (
    rules.find(
      rule => rule.from === fromLayer && rule.disallow.includes(toLayer)
    ) || null
  );
}

/**
 * Analyze a single source file for boundary violations.
 * v2.2: Supports alias resolution via single-hop lazy loading.
 */
function analyzeSourceFile(
  sourceFile: SourceFile,
  project: Project,
  cachedOptions: ParsedTsconfig,
  config: AiDebtConfig,
  cwd: string,
  relativeFilePath: string
): Finding[] {
  const findings: Finding[] = [];
  const importerAbsPath = sourceFile.getFilePath();

  // Determine importer's layer
  const fromLayer = matchLayer(importerAbsPath, cwd, config.layers);
  if (!fromLayer) return []; // File not in any layer

  // Get all import declarations
  const importDecls = sourceFile.getImportDeclarations();
  const exportDecls = sourceFile
    .getExportDeclarations()
    .filter(e => e.getModuleSpecifierValue()); // Only re-exports

  const allDecls: Array<ImportDeclaration | ExportDeclaration> = [
    ...importDecls,
    ...exportDecls,
  ];

  for (const decl of allDecls) {
    const moduleSpec = decl.getModuleSpecifierValue();
    if (!moduleSpec) continue;

    // v2.2: Remove relative-only filter - check ALL imports

    // Step 1: Try ts-morph native resolution
    const targetSourceFile = decl.getModuleSpecifierSourceFile();
    let targetAbsPath: string | null = targetSourceFile?.getFilePath() ?? null;

    // Step 2: If unresolved, use ts.resolveModuleName + lazy load (1 hop)
    if (!targetAbsPath) {
      const resolved = resolveModulePath(
        moduleSpec,
        importerAbsPath,
        cachedOptions.compilerOptions
      );
      if (resolved) {
        // Lazy load target file into project (single hop only)
        const loaded = project.addSourceFileAtPathIfExists(resolved);
        if (loaded) {
          targetAbsPath = loaded.getFilePath();
        }
      }
    }

    // v2.2: Additional filtering for ts-morph resolved files
    if (targetAbsPath) {
      // Skip node_modules (external packages)
      if (targetAbsPath.includes('node_modules')) continue;
      // Skip .d.ts (check BEFORE .ts since .d.ts ends with .ts)
      if (targetAbsPath.endsWith('.d.ts')) continue;
      // Skip non-.ts/.tsx
      if (!targetAbsPath.endsWith('.ts') && !targetAbsPath.endsWith('.tsx'))
        continue;
    }

    if (!targetAbsPath) continue; // Unresolved - skip silently

    // Determine target's layer
    const toLayer = matchLayer(targetAbsPath, cwd, config.layers);
    if (!toLayer) continue; // Target not in any layer

    // Find matching rule
    const matchedRule = findMatchingRule(fromLayer, toLayer, config.rules);
    if (!matchedRule) continue; // No violation

    // Emit finding
    const line = decl.getStartLineNumber();
    findings.push({
      id: `F_AST_BOUNDARY_${relativeFilePath.replace(
        /[^a-zA-Z0-9]/g,
        '_'
      )}_${line}`,
      ruleId: 'ast-boundary',
      severity: config.severity.boundary,
      confidence: 1,
      file: relativeFilePath,
      range: { start: line, end: line },
      message: `${fromLayer} -> ${toLayer} is not allowed: ${moduleSpec}`,
      evidence: matchedRule.message || undefined,
    });
  }

  return findings;
}

/**
 * AST Boundary Rule v2.2 - detects forbidden imports across architectural layers.
 * Supports:
 * - TypeScript path aliases (@/domain/user)
 * - Monorepo with multiple tsconfig.json
 * - Single-hop lazy loading for alias resolution
 * Pure rule: no constructor args, all inputs from AnalyzeContext.
 */
export class AstBoundaryRule implements Rule {
  id = 'ast-boundary';

  run(ctx: AnalyzeContext): Finding[] {
    const { config, cwd, changedFiles } = ctx;
    const findings: Finding[] = [];
    const tsconfigProjectMap = new Map<string, Project>();
    const tsconfigOptionsCache = new Map<string, ParsedTsconfig>();
    let runtimeFindingEmitted = false;

    // Filter to .ts/.tsx files that exist (exclude .d.ts)
    const tsFiles = changedFiles.filter(f => {
      const isTsFile =
        (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts');
      const absolutePath = path.resolve(cwd, f);
      return isTsFile && existsSync(absolutePath);
    });

    if (tsFiles.length === 0) return [];

    for (const file of tsFiles) {
      const absolutePath = path.resolve(cwd, file);

      // v2.2: Determine tsconfig - NEAREST FIRST, then fallback to cwd
      const nearest = findNearestTsconfig(absolutePath);
      const cwdTsconfig = path.resolve(cwd, 'tsconfig.json');
      const tsconfigPath =
        nearest ?? (existsSync(cwdTsconfig) ? cwdTsconfig : null);

      if (!tsconfigPath) {
        // Emit runtime finding only ONCE
        if (!runtimeFindingEmitted) {
          findings.push({
            id: 'F_AST_RUNTIME_tsconfig',
            ruleId: 'ast-boundary:runtime-tsconfig',
            severity: config.severity.runtime,
            confidence: 1,
            file: '__summary__',
            message: 'No tsconfig.json found, ast-boundary skipped',
          });
          runtimeFindingEmitted = true;
        }
        continue;
      }

      // v2.2: Get cached tsconfig options
      let cachedOptions = tsconfigOptionsCache.get(tsconfigPath);
      if (!cachedOptions) {
        const parsed = parseTsconfig(tsconfigPath);
        if (parsed) {
          cachedOptions = parsed;
          tsconfigOptionsCache.set(tsconfigPath, parsed);
        }
      }
      if (!cachedOptions) {
        if (!runtimeFindingEmitted) {
          findings.push({
            id: 'F_AST_RUNTIME_tsconfig_parse',
            ruleId: 'ast-boundary:runtime-parse',
            severity: config.severity.runtime,
            confidence: 1,
            file: '__summary__',
            message: `Failed to parse ${tsconfigPath}`,
          });
          runtimeFindingEmitted = true;
        }
        continue;
      }

      // Get or create project for this tsconfig
      let project = tsconfigProjectMap.get(tsconfigPath);
      if (!project) {
        try {
          project = new Project({
            tsConfigFilePath: tsconfigPath,
            skipAddingFilesFromTsConfig: true, // CRITICAL for performance
          });
          tsconfigProjectMap.set(tsconfigPath, project);
        } catch (error: unknown) {
          if (!runtimeFindingEmitted) {
            const message =
              error instanceof Error ? error.message : String(error);
            findings.push({
              id: 'F_AST_RUNTIME_init',
              ruleId: 'ast-boundary:runtime-parse',
              severity: config.severity.runtime,
              confidence: 1,
              file: '__summary__',
              message: `ts-morph initialization failed: ${message}`,
            });
            runtimeFindingEmitted = true;
          }
          continue;
        }
      }

      try {
        let sourceFile = project.getSourceFile(absolutePath);
        if (!sourceFile) {
          sourceFile = project.addSourceFileAtPathIfExists(absolutePath);
        }
        if (!sourceFile) continue;

        // v2.2: Pass cached options to analyzeSourceFile
        findings.push(
          ...analyzeSourceFile(
            sourceFile,
            project,
            cachedOptions,
            config,
            cwd,
            file
          )
        );
      } catch (error: unknown) {
        if (!runtimeFindingEmitted) {
          const message =
            error instanceof Error ? error.message : String(error);
          findings.push({
            id: 'F_AST_RUNTIME_parse',
            ruleId: 'ast-boundary:runtime-parse',
            severity: config.severity.runtime,
            confidence: 1,
            file: '__summary__',
            message: `Failed to parse file: ${message}`,
          });
          runtimeFindingEmitted = true;
        }
      }
    }

    // Cleanup
    tsconfigProjectMap.clear();
    tsconfigOptionsCache.clear();

    return findings;
  }
}
