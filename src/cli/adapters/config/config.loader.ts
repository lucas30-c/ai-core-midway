import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { UsageError } from '../../errors/cli.errors';
import {
  AiDebtConfig,
  SeverityConfig,
} from '../../../domain/analyze/config/config.types';
import { DEFAULT_CONFIG } from '../../../domain/analyze/config/default.config';

function normalizeSeverity(severity?: Partial<SeverityConfig>): SeverityConfig {
  return {
    boundary: severity?.boundary ?? 'HIGH',
    runtime: severity?.runtime ?? 'LOW',
  };
}

function validateConfig(config: unknown, sourcePath: string): AiDebtConfig {
  if (typeof config !== 'object' || config === null) {
    throw new UsageError(`Invalid config at ${sourcePath}: not an object`);
  }

  const cfg = config as Record<string, unknown>;

  // schemaVersion required
  if (typeof cfg.schemaVersion !== 'string') {
    throw new UsageError(
      `Invalid config at ${sourcePath}: schemaVersion is required (string)`
    );
  }

  // layers required, non-empty array
  if (!Array.isArray(cfg.layers) || cfg.layers.length === 0) {
    throw new UsageError(
      `Invalid config at ${sourcePath}: layers must be a non-empty array`
    );
  }

  // Validate each layer and check for duplicate names
  const seenNames = new Set<string>();
  for (const layer of cfg.layers) {
    if (typeof layer !== 'object' || layer === null) {
      throw new UsageError(
        `Invalid config at ${sourcePath}: each layer must be an object`
      );
    }
    const layerObj = layer as Record<string, unknown>;
    if (typeof layerObj.name !== 'string') {
      throw new UsageError(
        `Invalid config at ${sourcePath}: each layer must have a name (string)`
      );
    }
    if (!Array.isArray(layerObj.match)) {
      throw new UsageError(
        `Invalid config at ${sourcePath}: each layer must have a match array`
      );
    }
    if (seenNames.has(layerObj.name)) {
      throw new UsageError(
        `Invalid config at ${sourcePath}: duplicate layer name "${layerObj.name}"`
      );
    }
    seenNames.add(layerObj.name);
  }

  // rules required (can be empty)
  if (!Array.isArray(cfg.rules)) {
    throw new UsageError(
      `Invalid config at ${sourcePath}: rules must be an array`
    );
  }

  // Validate each rule
  for (const rule of cfg.rules) {
    if (typeof rule !== 'object' || rule === null) {
      throw new UsageError(
        `Invalid config at ${sourcePath}: each rule must be an object`
      );
    }
    const ruleObj = rule as Record<string, unknown>;
    if (typeof ruleObj.from !== 'string') {
      throw new UsageError(
        `Invalid config at ${sourcePath}: each rule must have a from (string)`
      );
    }
    if (!Array.isArray(ruleObj.disallow)) {
      throw new UsageError(
        `Invalid config at ${sourcePath}: each rule must have a disallow array`
      );
    }
  }

  return {
    schemaVersion: cfg.schemaVersion as string,
    layers: cfg.layers as AiDebtConfig['layers'],
    rules: cfg.rules as AiDebtConfig['rules'],
    severity: normalizeSeverity(cfg.severity as Partial<SeverityConfig>),
  };
}

export function loadAiDebtConfig(
  cwd: string,
  configPath?: string
): AiDebtConfig {
  // 1. If explicit config path provided
  if (configPath) {
    const resolvedPath = path.resolve(cwd, configPath);
    if (!existsSync(resolvedPath)) {
      throw new UsageError(`Config file not found: ${resolvedPath}`);
    }
    try {
      const content = readFileSync(resolvedPath, 'utf-8');
      const parsed = JSON.parse(content);
      return validateConfig(parsed, resolvedPath);
    } catch (err: unknown) {
      if (err instanceof UsageError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new UsageError(
        `Failed to parse config file ${resolvedPath}: ${message}`
      );
    }
  }

  // 2. Check for .ai-debt.json in cwd
  const defaultConfigPath = path.resolve(cwd, '.ai-debt.json');
  if (existsSync(defaultConfigPath)) {
    try {
      const content = readFileSync(defaultConfigPath, 'utf-8');
      const parsed = JSON.parse(content);
      return validateConfig(parsed, defaultConfigPath);
    } catch (err: unknown) {
      if (err instanceof UsageError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new UsageError(
        `Failed to parse config file ${defaultConfigPath}: ${message}`
      );
    }
  }

  // 3. Return default config
  return DEFAULT_CONFIG;
}
