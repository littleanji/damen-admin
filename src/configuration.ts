import { Configuration, App, Inject } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import * as validate from '@midwayjs/validate';
import * as info from '@midwayjs/info';
import { join } from 'path';
import { ReportMiddleware } from './middleware/report.middleware';
import { TokenMiddleware } from './middleware/token.middleware';
import { ResponseMiddleware } from './middleware/response.middleware';
import { ErrorMiddleware } from './middleware/err.middleware';
import { SeedService } from './service/auth/seed.service';
import * as Jwt from '@midwayjs/jwt';
import * as redis from '@midwayjs/redis';
import * as crossDomain from '@midwayjs/cross-domain'
import * as swagger from '@midwayjs/swagger';
import { AuthGuard } from './guard/auth.guard';
import { AuthCollectorService } from './service/auth/auth-collector.service';

@Configuration({
  imports: [
    koa,
    validate,
    Jwt,
    redis,
    crossDomain,
    swagger,
    {
      component: info,
      enabledEnvironment: ['local'],
    },
  ],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  @App('koa')
  app: koa.Application;

  @Inject()
  seedService: SeedService;

  @Inject()
  authService: AuthCollectorService;

  async onReady() {

    this.app.useMiddleware([ReportMiddleware, TokenMiddleware, ErrorMiddleware, ResponseMiddleware]);

    this.app.useGuard(AuthGuard);

  }

  async onServerReady() {
    const taskService = await this.app.getApplicationContext().getAsync('taskService');
    console.log(`线程池启动完成，工作线程数: ${taskService['workers'].length}`);
  }
}
