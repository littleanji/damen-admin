// src/service/seed.service.ts
import { Provide, Inject, Init, Scope, ScopeEnum } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { BusinessError } from '../../common/error';
import { PasswordUtil } from '../../utils/passwordUtil';
import { env } from 'process';

@Provide()
@Scope(ScopeEnum.Singleton)
export class SeedService {
    @Inject()
    db: DbService;

    /**
     * 初始化种子数据
     */
    @Init()
    async initData() {
        try {
            // 1. 检查是否已有用户
            const userCount = await this.db.client.user.count();

            if (userCount > 0) {
                console.log('数据库已有数据，跳过种子数据初始化');
                return;
            }

            console.log('开始初始化种子数据...');

            await this.createAdminUser();

            await this.createAuthMenus();


            console.log('种子数据初始化完成');
        } catch (error) {
            console.error('种子数据初始化失败:', error);
            throw new BusinessError('种子数据初始化失败');
        }
    }



    /**
     * 创建管理员用户
     * @param tenantId 租户ID
     */
    private async createAdminUser() {
        console.log('创建管理员用户...');
        const hashedPassword = await PasswordUtil.hash(env.ADMIN_PASSWORD);

        await this.db.client.user.create({
            data: {
                username: 'admin',
                password: hashedPassword,
                email: env.ADMIN_EMAIL,
                phone: env.ADMIN_PHONE,
                name: '主管理员',
                isAdmin: true
            },
        });

    }

    /**
     * 创建系统菜单
     * @param tenantId 租户ID
     */
    private async createAuthMenus() {
        console.log('创建系统菜单...');
        const menus = [
            {
                name: '首页',
                path: '/home/home',
                order: 1,
            },
            {
                name: '权限管理',
                path: '/auth',
                icon: 'SettingOutlined',
                order: 100,
                children: [
                    { name: '租户管理', path: '/auth/tenant', order: 101 },
                    { name: '用户管理', path: '/auth/user', order: 102 },
                    { name: '角色管理', path: '/auth/role', order: 103 },
                    { name: '菜单管理', path: '/auth/menu', order: 104 }
                ]
            }
        ];

        let rootMenu: any;


        const createMenu = async (menu: any, parentId?: string) => {
            return this.db.ignoreFilter(async (client) => {
                const created = await client.menu.upsert({
                    where: { path: menu.path },
                    create: {
                        name: menu.name,
                        path: menu.path,
                        icon: menu.icon,
                        order: menu.order,
                        parentId
                    },
                    update: {}
                });

                // 保存根菜单
                if (menu.path === '/system') {
                    rootMenu = created;
                }

                if (menu.children) {
                    for (const child of menu.children) {
                        await createMenu(child, created.id);
                    }
                }

                return created;
            });
        };

        for (const menu of menus) {
            await createMenu(menu);
        }

        return rootMenu;
    }


}