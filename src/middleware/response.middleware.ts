// src/middleware/response.middleware.ts
import { Middleware, IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

@Middleware()
export class ResponseMiddleware implements IMiddleware<Context, NextFunction> {
    static getName(): string {
        return 'response';
    }

    resolve() {
        return async (ctx: Context, next: NextFunction) => {
            try {
                const result = await next();

                ctx.body = {
                    code: 0,
                    status: true,
                    data: result
                };
            } catch (err) {

                throw err;
            }
        };
    }

    ignore(ctx: Context): boolean {

        return /\/swagger-ui.*|\/swagger-json|\/v3\/api-docs/.test(ctx.path);
    }
}