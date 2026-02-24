import * as ts from 'typescript';
import * as path from 'path';
import { ToolRunContext, ToolRunner } from '../tool.types';
import { Finding } from '../../rules/rule.types';
import { adaptTscDiagnosticsToFindings } from './tsc.adapter';

export class TscRunner implements ToolRunner {
  id = 'tsc';

  async run(ctx: ToolRunContext): Promise<Finding[]> {
    // 只关心变更的 ts/tsx 文件
    const changed = new Set(ctx.files.filter(f => /\.(ts|tsx)$/.test(f)));
    if (changed.size === 0) return [];

    const mode = ctx.tscMode || 'fast';

    try {
      const configPath = ts.findConfigFile(ctx.cwd, ts.sys.fileExists, 'tsconfig.json');
      if (!configPath) return [];

      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const config = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        ctx.cwd
      );

      // fast: 只编译变更文件；full: 全量编译
      const rootNames = mode === 'fast'
        ? Array.from(changed).map(f => path.join(ctx.cwd, f))
        : config.fileNames;

      const program = ts.createProgram({
        rootNames,
        options: { ...config.options, noEmit: true },
      });

      const diags = ts.getPreEmitDiagnostics(program);

      // fast: 不用过滤（本来就只编译变更文件）
      // full: 继续过滤到变更文件（避免全仓噪音）
      const filtered = mode === 'full'
        ? diags.filter(d => {
            const fileName = d.file?.fileName;
            if (!fileName) return true; // 全局/tsconfig 错误也要保留
            const rel = fileName.replace(ctx.cwd + '/', '');
            return changed.has(rel);
          })
        : diags;

      return adaptTscDiagnosticsToFindings(filtered, ctx.cwd);
    } catch (e: any) {
      return [
        {
          id: `F_TOOL_TSC_FAILED`,
          ruleId: 'tool:tsc',
          severity: 'HIGH',
          confidence: 1,
          file: '__tool__',
          message: 'TSC execution failed',
          evidence: String(e?.message ?? e),
        },
      ];
    }
  }
}