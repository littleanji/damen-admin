// src/service/tenant.service.ts
import { Provide } from '@midwayjs/core';
import { BusinessError } from '../../common/error';
import { asyncLocalStorage } from '../../db/context';
import { BaseService } from '../base.service';
import { PasswordUtil } from '../../utils/passwordUtil';

@Provide()
export class TenantService extends BaseService {
    async createTenant(data: {
        code: string;
        name: string;
        description?: string;
        startTime: Date;
        endTime: Date;
    }) {
        const tenant = await this.db.ignoreFilter(async (client) => {
            return client.tenant.create({
                data: {
                    ...data
                },
            });
        });
        if (!tenant) {
            throw new BusinessError('创建租户失败');
        } else {
            const hashedPassword = await PasswordUtil.hash(data.code + 123456);
            const user = await this.db.withTenant(tenant.id, '', async (client) => {
                return await client.user.create({
                    data: {
                        username: 'admin',
                        password: hashedPassword,
                        name: data.name,
                        isAdmin: true
                    }
                })
            })
            if (!user) {
                throw new BusinessError('租户管理员创建失败')
            }
        }
    }

    async getTenantByCode(code: string) {
        if (!code) return null;
        return this.db.ignoreFilter(async (client) => {
            const tenant = await client.tenant.findUnique({
                where: { code },
            });
            return tenant;
        });
    }

    async updateTenant(data: {
        id: string;
        name?: string;
        code?: string;
        description?: string;
        endTime?: Date;
        isActive?: boolean;
    }) {
        return this.db.ignoreFilter(async (client) => {
            return client.tenant.update({
                where: { id: data.id },
                data,
            });
        });
    }

    async deleteTenant(id: string) {
        return this.db.ignoreFilter(async (client) => {
            return client.tenant.update({
                where: { id },
                data: { isDel: true },
            });
        });
    }

    async getTenantById(id: string) {
        return this.db.ignoreFilter(async (client) => {
            const tenant = await client.tenant.findUnique({
                where: { id },
            });

            if (!tenant) {
                throw new BusinessError('租户不存在');
            }

            return tenant;
        });
    }

    async getTenants(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        isActive?: boolean;
    } = {}) {
        const {
            page = 1,
            pageSize = 20,
            search,
            startDate,
            endDate,
            isActive
        } = options;

        return this.db.ignoreFilter(async (client) => {
            const where: any = { isDel: false };

            if (search) {
                where.name = { contains: search };
            }

            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            if (startDate && endDate) {
                where.createdAt = {
                    gte: startDate,
                    lte: endDate
                };
            }

            let sql: any = {
                where,
                orderBy: { createdAt: 'desc' }
            }


            if (page && pageSize) {
                sql.skip = (page - 1) * pageSize;
                sql.take = pageSize;
            }

            const [items, total] = await Promise.all([
                client.tenant.findMany(sql),
                client.tenant.count({ where })
            ]);

            return {
                items,
                total
            };
        });
    }

    async checkTenantStatus(): Promise<boolean> {
        if (!asyncLocalStorage.getStore()?.tenantId) return true;

        const tenant = await this.db.ignoreFilter(async (client) => {
            return client.tenant.findUnique({
                where: { id: asyncLocalStorage.getStore()?.tenantId },
                select: { isActive: true, endTime: true, isDel: true },
            });
        });

        if (!tenant || tenant.isDel) {
            throw new BusinessError('租户不存在');
        }

        if (!tenant.isActive) {
            throw new BusinessError('租户已停用');
        }

        if (tenant.endTime < new Date()) {
            throw new BusinessError('租户已过期');
        }

        return true;
    }
}