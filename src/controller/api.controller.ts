import { Inject, Controller, Get, Query } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { UserService } from '../service/user.service';

@Controller('/api')
export class APIController {
  //  ✅ 每次请求都会是新的 ctx（请求级）
  @Inject()
  ctx: Context;

  @Inject()
  // ❗通常是单例（全局共享），不是每次创建
  userService: UserService; 

  // Midway/Koa 的核心是：请求级对象（ctx）+ 单例服务（service）。
  @Get('/get_user')
  async getUser(@Query('uid') uid) {
    const user = await this.userService.getUser({ uid });
    this.ctx.logger.info({ step: "controller", requestId: this.ctx.state.requestId });
    return { success: true, message: 'OK', data: user };
  }
}
