import { Inject, Controller, Get } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';

@Controller('/')
export class HomeController {
  @Inject()
  ctx: Context;
  @Get('/')
  async home(): Promise<string> {
    return 'Hello Midwayjs!';
  }
}
