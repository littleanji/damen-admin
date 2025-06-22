// src/service/base.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from './db/db.service';
import { asyncLocalStorage } from '../db/context';

@Provide()
export class BaseService {

    @Inject()
    protected db: DbService;

    protected getTenantId(): string | null {
        return asyncLocalStorage.getStore()?.tenantId || null;
    }

    protected getUserId(): string | null {
        return asyncLocalStorage.getStore()?.userId || null;
    }

    protected isHostContext(): boolean {
        return !this.getTenantId();
    }

    protected async withHostContext<T>(operation: (client: any) => Promise<T>): Promise<T> {
        return this.db.ignoreFilter(operation);
    }


    protected async getAll<T>(
        model: string,
        options: {
            page?: number;
            pageSize?: number;
            where?: any;
            dateField?: string;
            startDate?: Date;
            endDate?: Date;
            orderBy?: any;
            include?: any;
        } = {}
    ) {
        const {
            page = 1,
            pageSize = 20,
            where = {},
            dateField,
            startDate,
            endDate,
            orderBy = { createdAt: 'desc' },
            include
        } = options;

        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const finalWhere: any = { ...where };

        if (dateField && startDate && endDate) {
            finalWhere[dateField] = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client[model.toLowerCase()].findMany({
                where: finalWhere,
                skip,
                take,
                orderBy,
                include
            }),
            this.db.client[model.toLowerCase()].count({
                where: finalWhere
            })
        ]);

        return {
            items,
            total
        };
    }
}