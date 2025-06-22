// src/service/menu.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { TenantService } from './tenant.service';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';

@Provide()
export class MenuService extends BaseService {
    @Inject()
    db: DbService;

    @Inject()
    tenantService: TenantService;



    async createMenu(data: {
        name: string;
        path: string;
        icon?: string;
        order?: number;
        parentId?: string;
    }) {
        return this.db.client.menu.create({ data });
    }

    async updateMenu(data: {
        id: string,
        name?: string;
        path?: string;
        icon?: string;
        order?: number;
        parentId?: string | null;
    }) {

        return this.db.client.menu.update({
            where: { id: data.id },
            data
        });
    }

    async deleteMenu(id: string) {
        return this.db.client.menu.delete({
            where: { id },
        });
    }

    async getMenuById(id: string) {
        const menu = await this.db.client.menu.findUnique({
            where: { id },
            include: {
                children: true
            }
        });

        if (!menu) {
            throw new BusinessError('菜单不存在');
        }

        return menu;
    }

    async getMenuByCode(code: string) {
        return await this.db.client.menu.findFirst({
            where: {
                OR: [
                    { name: { contains: code } },
                    { path: { contains: code } },
                ]
            }
        });
    }

    async getMenus(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        parentId?: string | null;
    } = {}) {
        const {
            page = 1,
            pageSize = 10,
            search,
            startDate,
            endDate,
            parentId
        } = options;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { path: { contains: search } }
            ];
        }

        if (parentId !== undefined) {
            where.parentId = parentId;
        }

        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client.menu.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { order: 'asc' }
            }),
            this.db.client.menu.count({ where })
        ]);

        return {
            items,
            total
        };
    }

    async getMenuTree() {
        const menus = await this.db.client.menu.findMany({
            orderBy: { order: 'asc' },
        });

        if (this.getTenantId()) delete menus[1].children[0];

        return this.buildMenuTree(menus);
    }

    private buildMenuTree(menus: any[], parentId: string | null = null): any[] {
        return menus
            .filter(menu => menu.parentId === parentId)
            .map(menu => ({
                ...menu,
                children: this.buildMenuTree(menus, menu.id),
            }));
    }
}