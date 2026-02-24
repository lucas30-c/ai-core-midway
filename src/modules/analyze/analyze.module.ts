import { Configuration } from '@midwayjs/core';
import * as validate from '@midwayjs/validate';

@Configuration({
  namespace: 'analyze',
  imports: [validate],
})
export class AnalyzeConfiguration {}

export const AnalyzeModule = {
  Configuration: AnalyzeConfiguration,
};
