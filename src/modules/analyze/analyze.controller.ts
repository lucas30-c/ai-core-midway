import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { AnalyzeDiffDTO } from './analyze.dto';
import { AnalyzeService } from './analyze.service';

@Controller('/analyze')
export class AnalyzeController {
  @Inject()
  ctx: Context;

  @Inject()
  analyzeService: AnalyzeService;

  @Post('/diff')
  async analyzeDiff(@Body() body: AnalyzeDiffDTO) {
    const requestId = this.ctx.state.requestId;
    const traceId = this.ctx.state.traceId;

    const result = await this.analyzeService.analyzeDiff(body.diff, {
      requestId,
      traceId,
      tscMode: body.tscMode,
    });

    return {
      requestId,
      traceId,
      ...result,
    };
  }
}
