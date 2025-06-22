import { AsyncLocalStorage } from 'async_hooks';

export type PrismaContext = {
    tenantId: string;
    userId: string;
    bypassGlobalFilter: boolean;
};

export const asyncLocalStorage = new AsyncLocalStorage<PrismaContext>();  