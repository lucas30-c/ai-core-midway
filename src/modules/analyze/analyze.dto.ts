import { Rule, RuleType } from '@midwayjs/validate';

export class AnalyzeDiffDTO {
  @Rule(RuleType.string().required())
  diff: string;
}
