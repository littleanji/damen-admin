import { Provide, Init, Inject, Scope, ScopeEnum, listModule, CONTROLLER_KEY, getPropertyMetadata } from '@midwayjs/core';
import { AUTH_KEY } from '../../decorator/auth.decorator';
import { RedisServiceManage } from '../../service/redis/redis.service';
import { DAMENAUTH } from '../../utils/const';

@Provide()
@Scope(ScopeEnum.Singleton)
export class AuthCollectorService {

    @Inject()
    redis: RedisServiceManage

    @Init()
    async collectPermissions() {
        const controllers = listModule(CONTROLLER_KEY);
        const permissions: any = [];

        for (const controller of controllers) {
            const controllerName = controller.name;
            const controllerPrefix = this.getControllerPrefix(controllerName);

            const methodNames = Object.getOwnPropertyNames(controller.prototype)
                .filter(name => name !== 'constructor' && typeof controller.prototype[name] === 'function');

            for (const methodName of methodNames) {
                const authMeta = getPropertyMetadata(
                    AUTH_KEY,
                    controller.prototype,
                    methodName
                );

                if (!authMeta) continue;

                const { description, customKey } = authMeta;
                const permissionKey = customKey || `${controllerPrefix}:${methodName}`;

                const permissionInfo: any = {
                    description,
                    key: permissionKey,
                    menu: `/${controllerPrefix}`,
                };

                permissions.push(permissionInfo);
            }
        }

        this.redis.getJson(DAMENAUTH) && await this.redis.del(DAMENAUTH);

        this.redis.saveJson(DAMENAUTH, permissions);
    }

    private getControllerPrefix(controllerName: string): string {
        return controllerName
            .replace(/Controller$/, '')
            .toLowerCase()
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase();
    }
}