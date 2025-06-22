// src/middleware/tenant.middleware.ts
import { Config, IMiddleware, Inject, Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { asyncLocalStorage } from '../db/context';
import { JwtService } from '@midwayjs/jwt';
import { UnauthorizedError } from '../common/error';

@Middleware()
export class TokenMiddleware implements IMiddleware<Context, NextFunction> {
    @Inject()
    jwtService: JwtService;

    @Config('jwt.secret')
    jwtSecret: string;

    resolve() {
        return async (ctx: Context, next: NextFunction) => {

            if (!this.match(ctx)) {
                return await next();
            }

            if (!ctx.headers['authorization']) {
                throw new UnauthorizedError('请求未授权');
            }

            const parts = ctx.get('authorization').trim().split(' ');
            if (parts.length !== 2) {
                throw new UnauthorizedError('请求未授权');
            }

            const [scheme, token] = parts;

            let tenantId: string | null = null;

            let userId: string | null = null;

            if (/^Bearer$/i.test(scheme)) {
                try {
                    const payload = await this.jwtService.verify(token, this.jwtSecret, {
                        complete: true,
                    }) as any;

                    payload.payload.tenantId && (tenantId = payload.payload.tenantId);

                    payload.payload.userId && (userId = payload.payload.userId);

                } catch (error) {
                    //     //token过期 生成新的token
                    //     const newToken = getToken(user);
                    //     //将新token放入Authorization中返回给前端
                    //     ctx.set('Authorization', newToken);
                    throw new UnauthorizedError('token无效');
                }
            }

            // 1. 从请求中提取租户ID

            // 2. 创建上下文对象
            const context = {
                tenantId,
                userId,
                bypassGlobalFilter: false
            };

            // 3. 使用异步本地存储运行后续中间件
            return asyncLocalStorage.run(context, async () => {
                try {
                    return await next();
                } catch (err) {
                    ctx.logger.error('请求处理失败', err);
                    throw err;
                }
            });
        };
    }

    public match(ctx: Context): boolean {
        return !ctx.path.includes('/api/auth/login');
    }
}