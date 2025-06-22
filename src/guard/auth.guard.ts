import { Guard, IGuard } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { AUTH_KEY } from '../decorator/auth.decorator';
import { getPropertyMetadata, Inject } from '@midwayjs/core/dist/decorator';
import { BusinessError } from '../common/error';
import { PermissionService } from '../service/auth/permission.service';
import { asyncLocalStorage } from '../db/context';
import { UserService } from '../service/auth/user.service';


@Guard()
export class AuthGuard implements IGuard {

    @Inject()
    permissionService: PermissionService;

    @Inject()
    userService: UserService;

    async canActivate(ctx: Context, supplierClz: any, methodName: string): Promise<boolean> {
        // 1. 获取权限元数据
        const authMeta = getPropertyMetadata(
            AUTH_KEY,
            supplierClz,
            methodName
        );

        if (!authMeta) {
            return true;
        }

        const userId = asyncLocalStorage.getStore()?.userId || null;

        const isAdmin = await this.userService.isAdmin(userId);

        if (isAdmin) {
            return true;
        }

        const { description, customKey } = authMeta;

        const controllerName = supplierClz.name;

        const methodKey = customKey || `${this.getControllerPrefix(controllerName)}:${methodName}`;

        if (methodKey && methodKey == 'stop') {
            throw new BusinessError(`${description}功能被临时关闭`);
        }

        const permission = await this.permissionService.getPermissionById(userId);

        const hasPermission = permission?.actions.includes(methodKey);

        if (!hasPermission) {
            throw new BusinessError(`缺少权限: ${description}`);
        }

        return true;
    }

    // 从控制器名提取前缀
    private getControllerPrefix(controllerName: string): string {
        return controllerName
            .replace(/Controller$/, '')
            .toLowerCase()
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase();
    }
}