import { Middleware, IMiddleware } from '@midwayjs/core';
import { NextFunction, Context } from '@midwayjs/koa';

@Middleware()
export class ReportMiddleware implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {

      const startTime = Date.now();

      const result = await next();

      ctx.logger.info(
        `Report in "src/middleware/report.middleware.ts", rt = ${Date.now() - startTime
        }ms`
      );
      return result;
    };
  }

  static getName(): string {
    return 'report';
  }
}
