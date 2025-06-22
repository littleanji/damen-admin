// src/service/permission.service.ts
import { Provide, Inject, Scope, ScopeEnum } from '@midwayjs/core';
import { TenantService } from './tenant.service';
import { BaseService } from '../base.service';
import { RedisServiceManage } from '../redis/redis.service';
import { DAMENAUTH } from '../../utils/const';
import { MenuService } from './menu.service';
import { UserService } from './user.service';

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class PermissionService extends BaseService {

    @Inject()
    tenantService: TenantService;

    @Inject()
    redis: RedisServiceManage;

    @Inject()
    menuService: MenuService;

    @Inject()
    userService: UserService;

    /**
  * 创建权限
  * @param data 权限数据
  * @returns 创建的权限
  */
    async createOrUpdatePermissions(data: {
        userId?: string;
        roleId?: string;
        menuId: string;
        actions: string[];
        dataScope?: string;
    }[]) {

        const menuIdsToKeep = [...new Set(data.map(perm => perm.menuId))];

        const home = await this.menuService.getMenuByCode('首页');

        menuIdsToKeep.push(home.id);

        let deleteCondition = {};
        if (data[0].userId) {
            deleteCondition = {
                userId: data[0].userId,
                menuId: { notIn: menuIdsToKeep }
            };
        } else if (data[0].roleId) {
            deleteCondition = {
                roleId: data[0].roleId,
                menuId: { notIn: menuIdsToKeep }
            };
        }

        const transactions: any[] = [
            ...data.map(perm => this.createOrUpdatePermission(perm)),
            this.db.client.permission.deleteMany({ where: deleteCondition })
        ]

        return this.db.client.$transaction(transactions);
    }

    private createOrUpdatePermission(data: {
        userId?: string;
        roleId?: string;
        menuId?: string;
        actions: string[];
        dataScope?: string;
    }) {
        const { userId, roleId, menuId, actions, dataScope } = data;

        const type = data.userId ? 'USER' : 'ROLE';

        const uniqueConstraint = userId
            ? { type_userId_menuId: { type, userId, menuId } }
            : { type_roleId_menuId: { type, roleId, menuId } };

        return this.db.client.permission.upsert({
            where: uniqueConstraint,
            update: {
                actions: { set: actions },
                dataScope,
            },
            create: {
                type,
                userId,
                roleId,
                menuId,
                actions: { set: actions },
                dataScope
            }
        });
    }


    /**
  * 删除权限
  * @param id 权限ID
  * @returns 删除的权限
  */
    async deletePermission(id: string) {
        // 删除权限
        return this.db.client.permission.delete({
            where: { id }
        });
    }


    // 获取权限详情
    async getPermissionById(id: string) {
        return this.db.client.permission.findUnique({
            where: { id },
            include: {
                user: true,
                role: true
            }
        });
    }

    // 分页查询权限
    // async getPermissions(options: {
    //     page?: number;
    //     pageSize?: number;
    //     userId?: string;
    //     roleId?: string;
    //     menuId?: string;
    //     type?: 'USER' | 'ROLE';
    //     startDate?: Date;
    //     endDate?: Date;
    // } = {}) {
    //     const {
    //         page = 1,
    //         pageSize = 20,
    //         userId,
    //         roleId,
    //         menuId,
    //         type,
    //         startDate,
    //         endDate
    //     } = options;

    //     // 构建查询条件
    //     const where: any = {};

    //     if (userId) where.userId = userId;
    //     if (roleId) where.roleId = roleId;
    //     if (menuId) where.menuId = menuId;
    //     if (type) where.type = type;

    //     // 日期范围查询
    //     if (startDate && endDate) {
    //         where.createdAt = {
    //             gte: startDate,
    //             lte: endDate
    //         };
    //     }

    //     const [items, total] = await Promise.all([
    //         this.db.client.permission.findMany({
    //             where,
    //             skip: (page - 1) * pageSize,
    //             take: pageSize,
    //             orderBy: { createdAt: 'desc' },
    //             include: {
    //                 menu: true,
    //                 user: true,
    //                 role: true
    //             }
    //         }),
    //         this.db.client.permission.count({ where })
    //     ]);

    //     return {
    //         items,
    //         total
    //     };
    // }

    /**
   * 根据用户ID获取所有权限（包括角色权限和用户直接权限）
   * @param userId 用户ID
   * @returns 合并后的权限列表
   */
    async getUserPermissions(userId: string) {
        // 获取用户信息（包含角色）
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
            include: {
                permissions: true
            }
        });

        // 如果是管理员，返回特殊标记
        if (user.isAdmin) {
            return { isAdmin: true, permissions: [] };
        }

        // 获取用户直接分配的权限
        // const directPermissions = await this.db.client.permission.findMany({
        //     where: {
        //         userId,
        //         type: 'USER'
        //     },
        //     include: { menu: true }
        // });

        // 获取通过角色分配的权限
        // const roleIds = user.roles.map(role => role.id);
        // const rolePermissions = await this.db.client.permission.findMany({
        //     where: {
        //         roleId: { in: roleIds },
        //         type: 'ROLE'
        //     },
        //     include: { menu: true }
        // });

        // 合并权限并去重（按menuId去重）
        // const allPermissions = [...directPermissions, ...rolePermissions];
        // const uniquePermissions = allPermissions.reduce((acc, curr) => {
        //     if (!acc.some(p => p.menuId === curr.menuId)) {
        //         acc.push(curr);
        //     }
        //     return acc;
        // }, []);

        return {
            isAdmin: false,
            permissions: user.permissions
        };
    }

    /**
    * 根据角色ID获取所有权限
    * @param roleId 角色ID
    * @returns 权限列表
    */
    async getRolePermissions(roleId: string) {
        return this.db.client.permission.findMany({
            where: { roleId, type: 'ROLE' },
            distinct: ['menuId'], // 按menuId去重
            include: { menu: true }
        });
    }

    /**
  * 合并数据范围（取最宽泛的范围）
  * @param scope1 数据范围1
  * @param scope2 数据范围2
  * @returns 合并后的数据范围
  */
    // private mergeDataScope(scope1: any, scope2: any) {
    //     // 默认优先级：all > department > personal
    //     const scopePriority = { 'all': 3, 'department': 2, 'personal': 1 };

    //     const scope1Value = scope1?.scope || 'personal';
    //     const scope2Value = scope2?.scope || 'personal';

    //     return scopePriority[scope1Value] > scopePriority[scope2Value]
    //         ? scope1
    //         : scope2;
    // }

    /**
  * 获取所有权限
  * @returns 权限列表
  */
    async getPermissions() {
        return this.combineMenuWithPermissions(await this.menuService.getMenuTree(), await this.redis.getJson(DAMENAUTH));
    }

    /**
  * 将菜单树与权限列表合并
  * @param menus 菜单树
  * @param permissions 权限列表
  * @returns 合并后的菜单树
  */
    private combineMenuWithPermissions(menus: any, permissions: any) {
        // 1. 将权限按菜单路径分组
        const permissionsByMenu = permissions.reduce((acc, perm) => {
            const menuPath = perm.menu;
            if (!acc[menuPath]) {
                acc[menuPath] = {
                    actions: [],
                };
            }

            // 添加到权限对象
            acc[menuPath].actions.push({ description: perm.description, key: perm.key });

            return acc;
        }, {});

        // 2. 递归处理菜单树
        const processMenu = (menu) => {
            if (menu.path == '/home/home' || menu.path == '/auth/tenant') {
                return;
            }
            const result = {
                id: menu.id,
                name: menu.name,
                path: menu.path,
                children: []
            } as any;

            const path = `/${menu.path.split('/').at(-1)}`;
            // 添加权限信息
            if (permissionsByMenu[path]) {
                result.auth = {
                    actions: permissionsByMenu[path]?.actions,
                };
            } else {
                result.auth = {
                    actions: []
                };
            }

            const authKey = menu.path.split('/').at(-1);

            const viewAuths = [
                { description: '金额', key: `${authKey}:price` },
                { description: '打印', key: `${authKey}:print` },
                { description: '导入', key: `${authKey}:import` },
                { description: '导出', key: `${authKey}:export` },
            ]

            viewAuths.map((e: any) => !menu.children.length && result.auth.actions.push(e))

            // 处理子菜单
            if (menu.children && menu.children.length) {
                result.children = menu.children.map(child => processMenu(child));
            }

            return result;
        };

        return menus.map(menu => processMenu(menu));
    };

    async getUserMenuTreeWithAuth(user: any) {
        // const user = await this.db.client.user.findUnique({
        //     where: { id },
        //     include: {
        //         roles: {
        //             include: true
        //         },
        //         permissions: {
        //             include: {
        //                 menu: true
        //             }
        //         }
        //     }
        // });

        // 2. 如果是管理员，返回所有菜单并赋予全量权限
        if (user.isAdmin) {
            const allMenus = await this.db.client.menu.findMany({
                orderBy: { order: 'asc' }
            });

            return this.buildMenuTree(allMenus.map(menu => ({
                ...menu,
                auth: {
                    actions: ['*'], // 通配符表示所有操作
                    dataScope: { scope: 'ALL' } // 全部数据范围
                }
            })));
        }

        // 3. 获取用户所有权限（直接权限 + 角色权限）
        // const allPermissions = [
        //     ...user.permissions,
        //     ...user.roles.flatMap(role => role.permissions)
        // ];

        // 4. 按菜单ID分组合并权限
        const menuPermissionsMap = new Map<string, any>();

        user.permissions.forEach(perm => {
            if (!perm.menuId) return;

            if (!menuPermissionsMap.has(perm.menuId)) {
                menuPermissionsMap.set(perm.menuId, {
                    actions: new Set<string>(),
                    dataScope: perm.dataScope || null
                });
            }

            const menuPerm = menuPermissionsMap.get(perm.menuId);
            perm.actions.forEach(action => menuPerm.actions.add(action));

            // 数据范围优先级：用户直接权限 > 角色权限
            // if (perm.type === 'USER' && perm.dataScope) {
            //     menuPerm.dataScope = perm.dataScope;
            // }
        });

        // // 5. 获取有权限的菜单ID集合（包括父级菜单）
        // const permittedMenuIds = new Set<string>();

        // // 添加直接有权限的菜单
        // menuPermissionsMap.forEach((_, menuId) => {
        //     permittedMenuIds.add(menuId);
        // });

        // 添加父级菜单（确保菜单树完整）
        // const addParentMenus = async (menuId: string) => {
        //     const menu = await this.db.client.menu.findUnique({
        //         where: { id: menuId },
        //         select: { parentId: true }
        //     });

        //     if (menu?.parentId) {
        //         permittedMenuIds.add(menu.parentId);
        //         await addParentMenus(menu.parentId);
        //     }
        // };

        // for (const menuId of permittedMenuIds) {
        //     await addParentMenus(menuId);
        // }

        // 6. 获取所有需要显示的菜单
        // const menus = await this.db.client.menu.findMany({
        //     where: {
        //         id: { in: Array.from(permittedMenuIds) }
        //     },
        //     orderBy: { order: 'asc' }
        // });


        // 7. 构建菜单树并添加权限
        return this.buildMenuTree(user.permissions.map((e: any) => e.menu).map(menu => {
            const menuPerm = menuPermissionsMap.get(menu.id);

            return {
                ...menu,
                auth: menuPerm ? {
                    actions: Array.from(menuPerm.actions),
                    dataScope: menuPerm.dataScope
                } : {
                    actions: [], // 父级菜单可能没有直接权限
                    dataScope: null
                }
            };
        }));

    }

    // 辅助函数：构建菜单树结构
    private buildMenuTree(menus: any[], parentId: string | null = null) {
        return menus
            .filter(menu => menu.parentId === parentId)
            .map(menu => ({
                id: menu.id,
                name: menu.name,
                path: menu.path,
                icon: menu.icon,
                order: menu.order,
                auth: menu.auth, // 包含权限信息
                children: this.buildMenuTree(menus, menu.id)
            }));
    }


}