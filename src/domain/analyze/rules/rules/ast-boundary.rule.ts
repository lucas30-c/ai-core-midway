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

/**
 * Match a file path to a layer based on glob patterns.
 * Uses path.relative for safe cross-platform normalization.
 */
function matchLayer(
  absoluteFilePath: string,
  cwd: string,
  layers: LayerConfig[]
): string | null {
  // Use path.relative for safe cross-platform normalization
  const relativePath = posix.normalize(
    path.relative(cwd, absoluteFilePath).replace(/\\/g, '/')
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
 * Manual fallback resolution when ts-morph can't resolve.
 */
function resolveManually(
  importerAbsPath: string,
  moduleSpecifier: string
): string | null {
  const importerDir = path.dirname(importerAbsPath);
  const basePath = path.resolve(importerDir, moduleSpecifier);

  const tryPaths = [
    basePath + '.ts',
    basePath + '.tsx',
    basePath + '.d.ts',
    basePath + '/index.ts',
    basePath + '/index.tsx',
  ];

  for (const candidate of tryPaths) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Analyze a single source file for boundary violations.
 */
function analyzeSourceFile(
  sourceFile: SourceFile,
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

    // Only check relative imports
    if (!moduleSpec.startsWith('./') && !moduleSpec.startsWith('../')) {
      continue;
    }

    // Resolve target file using ts-morph native resolution
    const targetSourceFile = decl.getModuleSpecifierSourceFile();
    let targetAbsPath: string | null = null;

    if (targetSourceFile) {
      targetAbsPath = targetSourceFile.getFilePath();
    } else {
      // Manual fallback resolution
      targetAbsPath = resolveManually(importerAbsPath, moduleSpec);
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
 * AST Boundary Rule - detects forbidden imports across architectural layers.
 * Pure rule: no constructor args, all inputs from AnalyzeContext.
 */
export class AstBoundaryRule implements Rule {
  id = 'ast-boundary';

  run(ctx: AnalyzeContext): Finding[] {
    const { config, cwd, changedFiles } = ctx;

    // Early exit - check tsconfig (v1: cwd-only, no find-up)
    const tsconfigPath = path.resolve(cwd, 'tsconfig.json');
    if (!existsSync(tsconfigPath)) {
      return [
        {
          id: 'F_AST_RUNTIME_tsconfig',
          ruleId: 'ast-boundary:runtime-tsconfig',
          severity: config.severity.runtime,
          confidence: 1,
          file: '__summary__',
          message: `tsconfig.json not found in ${cwd}, ast-boundary skipped`,
        },
      ];
    }

    // Filter to .ts/.tsx files that exist on disk
    const tsFiles = changedFiles.filter(f => {
      const isTsFile = f.endsWith('.ts') || f.endsWith('.tsx');
      const absolutePath = path.resolve(cwd, f);
      return isTsFile && existsSync(absolutePath);
    });

    if (tsFiles.length === 0) return [];

    // Create project with error handling
    let project: Project;
    try {
      project = new Project({ tsConfigFilePath: tsconfigPath });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return [
        {
          id: 'F_AST_RUNTIME_init',
          ruleId: 'ast-boundary:runtime-parse',
          severity: config.severity.runtime,
          confidence: 1,
          file: '__summary__',
          message: `ts-morph initialization failed: ${message}`,
        },
      ];
    }

    // Analyze files
    const findings: Finding[] = [];
    let runtimeFindingEmitted = false;

    for (const file of tsFiles) {
      try {
        const absolutePath = path.resolve(cwd, file);

        // Avoid duplicate: check if already in project
        let sourceFile = project.getSourceFile(absolutePath);
        if (!sourceFile) {
          sourceFile = project.addSourceFileAtPath(absolutePath);
        }

        findings.push(...analyzeSourceFile(sourceFile, config, cwd, file));
      } catch (error: unknown) {
        // Emit runtime finding only once per run
        if (!runtimeFindingEmitted) {
          const message =
            error instanceof Error ? error.message : String(error);
          findings.push({
            id: 'F_AST_RUNTIME_parse',
            ruleId: 'ast-boundary:runtime-parse',
            severity: config.severity.runtime,
            confidence: 1,
            file: file,
            message: `Failed to parse ${file}: ${message}`,
          });
          runtimeFindingEmitted = true;
        }
        // Continue to next file
      }
    }

    return findings;
  }
}
