import { Rule, RuleType } from '@midwayjs/validate';
import { ChatMessage } from '../../core/llm/llm.types';

export class ChatBodyDTO {
  @Rule(RuleType.array().min(1).required())
  messages: ChatMessage[];

  @Rule(RuleType.number().min(0).max(2).optional())
  temperature?: number;

  @Rule(RuleType.string().optional())
  model?: string;
}
