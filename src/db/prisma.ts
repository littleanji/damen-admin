
import { PrismaClient } from '../generated/prisma/client';
import { asyncLocalStorage } from './context';
import { BusinessError } from '../common/error';
import { DELETEMODELS } from '../utils/const';

console.log('Prisma模块加载 - 开始初始化');

type BasePrismaClient = ReturnType<typeof createBasePrismaClient>;

const createBasePrismaClient = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'production'
            ? ['error']
            : ['info', 'query', 'warn', 'error'],
    });
};


const createExtendedPrismaClient = (basePrisma: BasePrismaClient) => {
    return basePrisma.$extends((client: any) => {
        return client.$use(async (params: any, next: any) => {
            try {
                const context = asyncLocalStorage.getStore();
                const tenantId = context?.tenantId || null;

                if (context?.bypassGlobalFilter) {
                    return next(params);
                }

                if (['create', 'createMany', 'upsert'].includes(params.action)) {
                    if (context?.hasOwnProperty('tenantId') && params.model !== 'Tenant') {
                        if (params.action === 'create') {
                            params.args.data = {
                                ...params.args.data,
                                tenantId: params.args.data.tenantId ?? tenantId,
                            };
                        }
                        if (params.action === 'createMany' && Array.isArray(params.args.data)) {
                            params.args.data = params.args.data.map(item => ({
                                ...item,
                                tenantId: item.tenantId ?? tenantId,
                            }));
                        }
                        if (params.action === 'upsert') {
                            params.args.create = {
                                ...params.args.create,
                                tenantId: params.args.create.tenantId ?? tenantId,
                            };
                        }
                    }
                }

                if (['update', 'updateMany', 'upsert'].includes(params.action)) {
                    if (params.model !== 'Tenant' && params.args.data?.tenantId) {
                        delete params.args.data.tenantId;
                    }
                }


                if (params.action === 'delete') {
                    if (DELETEMODELS.includes(params.model)) {
                        params.action = 'update';
                        params.args.data = { isDel: true };
                    }
                }

                if (params.action === 'deleteMany') {
                    if (DELETEMODELS.includes(params.model)) {
                        params.action = 'updateMany';
                        params.args.data = { isDel: true };
                    }
                }

                const shouldApplyFilter = [
                    'findUnique', 'findFirst', 'findFirstOrThrow', 'findMany',
                    'count', 'aggregate', 'groupBy',
                    'update', 'updateMany', 'delete', 'deleteMany', 'upsert'
                ].includes(params.action) && params.model !== 'Tenant';

                if (shouldApplyFilter) {

                    if (!params.args) params.args = {};

                    if (!params.args.where) params.args.where = {};

                    const newConditions: any = {};

                    if (context?.hasOwnProperty('tenantId')) {
                        newConditions.tenantId = tenantId;
                    }

                    if (DELETEMODELS.includes(params.model as string) &&
                        !['delete', 'deleteMany'].includes(params.action)) {
                        newConditions.isDel = false;
                    }

                    if (Object.keys(newConditions).length > 0) {
                        params.args.where = mergeWhereConditions(
                            params.args.where,
                            newConditions
                        );
                    }
                }

                return next(params);
            } catch (error) {
                throw new BusinessError(error);
            }
        });


        function mergeWhereConditions(existingWhere: any, newConditions: any): any {
            if (existingWhere.AND) {
                return {
                    AND: [...existingWhere.AND, newConditions]
                };
            }

            if (existingWhere.OR) {
                return {
                    AND: [
                        { OR: existingWhere.OR },
                        newConditions
                    ]
                };
            }

            const keys = Object.keys(existingWhere);
            if (keys.length > 0 && keys.some(key => key === 'AND' || key === 'OR' || key === 'NOT')) {
                return {
                    AND: [
                        existingWhere,
                        newConditions
                    ]
                };
            }

            return {
                ...existingWhere,
                ...newConditions
            };
        }
    })
}

console.log('Prisma客户端扩展完成');

let prismaInstance: any = null;

export const getPrismaClient = () => {
    if (!prismaInstance) {
        const basePrisma = createBasePrismaClient();

        const extendedPrisma = createExtendedPrismaClient(basePrisma);

        prismaInstance = Object.assign({}, extendedPrisma);

        const modelNames = Object.keys(basePrisma) as Array<keyof BasePrismaClient>;
        modelNames.forEach(modelName => {
            if (typeof basePrisma[modelName] === 'object') {
                prismaInstance[modelName] = basePrisma[modelName];
            }
        });

        prismaInstance.$connect = basePrisma.$connect.bind(basePrisma);
        prismaInstance.$disconnect = basePrisma.$disconnect.bind(basePrisma);
        prismaInstance.$use = basePrisma.$use.bind(basePrisma);
        prismaInstance.$extends = basePrisma.$extends.bind(basePrisma);
        prismaInstance.$transaction = basePrisma.$transaction.bind(basePrisma);

        console.log('Prisma客户端已初始化');
    }
    return prismaInstance;
};

export type ExtendedPrismaClient = ReturnType<typeof getPrismaClient>;