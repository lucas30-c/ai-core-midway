import execa = require('execa');
import { ToolRunContext, ToolRunner } from '../tool.types';
import { Finding } from '../../rules/rule.types';
import { adaptEslintJsonToFindings } from './eslint.adapter';

export class EslintRunner implements ToolRunner {
  id = 'eslint';

  async run(ctx: ToolRunContext): Promise<Finding[]> {
    const files = ctx.files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
    if (files.length === 0) return [];

    // ESLint exit code:
    // 0 = no problems
    // 1 = has lint errors
    // 2 = config/runtime error
    const args = [
      'eslint',
      '-f',
      'json',
      '--no-error-on-unmatched-pattern',
      ...files,
    ];

    try {
      const { stdout } = await execa('npx', args, {
        cwd: ctx.cwd,
        timeout: 60_000,
        reject: false, // important: 不因为 exitCode=1 就 throw
      });

      // stdout 是 JSON 数组
      const parsed = safeJsonParse(stdout);
      if (!parsed) return [];
      return adaptEslintJsonToFindings(parsed);
    } catch (e: any) {
      // 工具本身挂了：当成一个 HIGH finding 返回（可观测）
      return [
        {
          id: `F_TOOL_ESLINT_FAILED`,
          ruleId: 'tool:eslint',
          severity: 'HIGH',
          confidence: 1,
          file: '__tool__',
          message: 'ESLint execution failed',
          evidence: String(e?.message ?? e),
        },
      ];
    }
  }
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s || '[]');
  } catch {
    return null;
  }
}