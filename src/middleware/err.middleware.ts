// src/middleware/error.middleware.ts
import { Middleware, IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

@Middleware()
export class ErrorMiddleware implements IMiddleware<Context, NextFunction> {
    resolve() {
        return async (ctx: Context, next: NextFunction) => {
            try {
                await next();
            } catch (err) {
                ctx.logger.error(`[Error] ${err.message}\n${err.stack}`);

                ctx.status = this.getStatus(err);

                ctx.body = {
                    code: this.getErrorCode(err),
                    status: false,
                    message: this.getErrorMessage(err),
                    data: this.getErrorData(err)
                };
            }
        };
    }

    private getStatus(err: any): number {
        // if (err.status && typeof err.status == 'number') {
        //     return err.status;
        // }

        if (err.name == 'ValidationError') return 400;
        if (err.name == 'UnauthorizedError') return 401;
        if (err.name == 'ForbiddenError') return 403;

        return 500;
    }


    private getErrorCode(err: any): number {

        if (err.code && typeof err.code === 'number') {
            return err.code;
        }

        return 1;
    }

    private getErrorMessage(err: any): string {
        // 生产环境返回通用错误消息
        if (process.env.NODE_ENV === 'production') {
            return '服务器内部错误，请稍后再试';
        }

        // 开发环境返回详细错误
        return err.message || '未知错误';
    }

    private getErrorData(err: any): any {

        if (process.env.NODE_ENV !== 'production') {
            return {
                stack: err.stack
            };
        }

        return null;
    }
}