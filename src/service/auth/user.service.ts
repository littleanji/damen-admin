import { Provide, Inject, Scope, ScopeEnum } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { TenantService } from './tenant.service';
import { BusinessError } from '../../common/error';
import { PasswordUtil } from '../../utils/passwordUtil';
import { BaseService } from '../base.service';
import { AuthService } from './auth.service';
import { User } from '../../generated/prisma';
import { PermissionService } from './permission.service';
import { MenuService } from './menu.service';

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class UserService extends BaseService {
    @Inject()
    db: DbService;

    @Inject()
    tenantService: TenantService;

    @Inject()
    authService: AuthService;

    @Inject()
    permissionService: PermissionService;

    @Inject()
    menuService: MenuService;


    async createUser(data: {
        username: string;
        password: string;
        email?: string;
        phone?: string;
        name: string;
        isAdmin?: boolean;
    }) {

        if (!data.username || !data.password) {
            throw new BusinessError('用户名或密码不能为空');
        }

        const haveUser = await this.db.client.user.findFirst({
            where: {
                OR: [
                    { username: data.username },
                    { name: data.name }
                ]
            }
        });

        if (haveUser) throw new BusinessError('用户名或名称已存在');

        // 密码加密
        const hashedPassword = await PasswordUtil.hash(data.password);

        const user = await this.db.client.user.create({
            data: {
                ...data,
                password: hashedPassword
            },
        });

        if (!user) throw new BusinessError('创建用户失败');

        const menu = await this.menuService.getMenuByCode('首页');

        return await this.permissionService.createOrUpdatePermissions([
            {
                userId: user.id,
                menuId: menu.id,
                actions: [],
            }
        ]);
    }


    async updateUserRoles(data: {
        id: string;
        roleIds?: string[]
    }) {
        const { id, roleIds } = data
        return this.db.client.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: {
                    roles: {
                        set: []
                    }
                }
            });

            if (roleIds.length) {
                await tx.user.update({
                    where: { id },
                    data: {
                        roles: {
                            connect: roleIds.map(id => ({ id }))
                        }
                    }
                });
            }

        });
    }


    async updateUser(data: {
        id: string;
        email?: string;
        phone?: string;
        isAActive?: boolean;
        isAdmin?: boolean;
    }) {

        return this.db.client.user.update({
            where: { id: data.id },
            data: {
                ...data
            }
        });
    }


    async deleteUser(id: string) {
        return this.db.client.user.delete({
            where: { id },
        });
    }


    async findUsersByRole(role: string) {
        const users = await this.db.client.user.findMany({
            where: { roles: { some: { name: role } } }
        });
        return users;
    }


    async getUserById(id: string) {
        const user = await this.db.client.user.findUnique({
            where: { id },
            include: {
                roles: true,
                permissions: {
                    include: {
                        menu: true,
                    },
                },
            },
        });

        if (!user) {
            throw new BusinessError('用户不存在');
        }

        const menuTree = await this.permissionService.getUserMenuTreeWithAuth(user);

        delete user.password;

        return {
            user,
            menuTree,
        };
    }


    async findUserByUsername(tenantId: string | null, username: string) {
        const user: User = await this.withHostContext(async (client) => {
            return client.user.findFirst({
                where: {
                    username,
                    tenantId,
                    isDel: false
                },
            });
        });

        if (!user) throw new BusinessError('用户不存在');

        if (!user.isActive) throw new BusinessError('用户已被禁用');

        return user;
    }

    async getUsers(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        isAdmin?: boolean;
    } = {}) {
        const {
            page,
            pageSize,
            search,
            startDate,
            endDate,
            isAdmin,
        } = options;

        const where: any = {};

        if (search) {
            where.OR = [
                { username: { contains: search } },
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        if (isAdmin !== undefined) {
            where.isAdmin = isAdmin;
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
            this.db.client.user.findMany(sql),
            this.db.client.user.count({ where })
        ]);

        return {
            items: items.filter((e: any) => delete e.password),
            total
        };
    }


    async isAdmin(userId: string): Promise<boolean> {
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
            select: { isAdmin: true },
        });

        if (!user) {
            throw new BusinessError('用户不存在');
        }

        return user.isAdmin ?? false;
    }
}