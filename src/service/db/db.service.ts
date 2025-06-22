import { Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { asyncLocalStorage } from '../../db/context';
import { ExtendedPrismaClient, getPrismaClient } from '../../db/prisma';
import { BusinessError } from '../../common/error';


@Provide()
@Scope(ScopeEnum.Singleton)
export class DbService {
    private _client: ExtendedPrismaClient | null = null;

    get client(): ExtendedPrismaClient {
        if (!this._client) {
            this._client = getPrismaClient();

            this._client.$connect().catch(err => {
                throw new BusinessError('数据库连接失败:', err);
            });
        }
        return this._client;
    }

    async onStop() {
        if (this._client) {
            await this._client.$disconnect();
            console.log('Prisma连接已断开');
        }
    }

    async ignoreFilter<T>(
        operation: (client: ExtendedPrismaClient) => Promise<T>,
        options: { tenantId?: string, userId?: string } = {}
    ): Promise<T> {
        const currentContext = asyncLocalStorage.getStore();

        return asyncLocalStorage.run(
            {
                ...currentContext,
                tenantId: options.tenantId || currentContext?.tenantId || null,
                userId: options.tenantId || currentContext?.userId || null,
                bypassGlobalFilter: true
            },
            async () => {
                return operation(this.client);
            }
        );
    }


    async withTenant<T>(
        tenantId: string,
        userId: string,
        operation: (client: ExtendedPrismaClient) => Promise<T>
    ): Promise<T> {
        return asyncLocalStorage.run(
            { tenantId, userId, bypassGlobalFilter: false },
            async () => {
                return operation(this.client);
            }
        );
    }
}