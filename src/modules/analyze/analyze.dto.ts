import { Rule, RuleType } from '@midwayjs/validate';

export class AnalyzeDiffDTO {
  @Rule(RuleType.string().required())
  diff: string;

  @Rule(RuleType.string().valid('fast', 'full').optional())
  tscMode?: 'fast' | 'full';
}
