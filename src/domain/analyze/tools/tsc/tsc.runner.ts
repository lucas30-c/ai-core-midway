import * as ts from 'typescript';
import { ToolRunContext, ToolRunner } from '../tool.types';
import { Finding } from '../../rules/rule.types';
import { adaptTscDiagnosticsToFindings } from './tsc.adapter';

export class TscRunner implements ToolRunner {
  id = 'tsc';

  async run(ctx: ToolRunContext): Promise<Finding[]> {
    // 只关心变更的 ts/tsx 文件（减少噪音）
    const changed = new Set(ctx.files.filter(f => /\.(ts|tsx)$/.test(f)));

    try {
      const configPath = ts.findConfigFile(ctx.cwd, ts.sys.fileExists, 'tsconfig.json');
      if (!configPath) return [];

      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const config = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        ctx.cwd
      );

      const program = ts.createProgram({
        rootNames: config.fileNames,
        options: { ...config.options, noEmit: true },
      });

      const diags = ts.getPreEmitDiagnostics(program);

      // 过滤：只保留变更文件的诊断（否则全仓很多噪音）
      const filtered = diags.filter(d => {
        const fileName = d.file?.fileName;
        if (!fileName) return true; // 全局/tsconfig 错误也要保留
        const rel = fileName.replace(ctx.cwd + '/', '');
        return changed.has(rel);
      });

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