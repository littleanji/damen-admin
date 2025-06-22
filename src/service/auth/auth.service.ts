// src/service/auth.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { UserService } from './user.service';
import { MenuService } from './menu.service';
import { PermissionService } from './permission.service';
import { TenantService } from './tenant.service';
import { DbService } from '../db/db.service';
import { BaseService } from '../base.service';


@Provide()
export class AuthService extends BaseService {
    @Inject()
    userService: UserService;

    @Inject()
    menuService: MenuService;

    @Inject()
    permissionService: PermissionService;

    @Inject()
    tenantService: TenantService;

    @Inject()
    db: DbService;

    async getUserMenuTree(userId: string) {
        return this.permissionService.getUserPermissions(userId);
    }



    private filterMenuTree(menuTree: any[], allowedMenuIds: string[]): any[] {
        return menuTree
            .filter(menu => {
                const hasPermission = allowedMenuIds.includes(menu.id);
                const children = this.filterMenuTree(menu.children, allowedMenuIds);
                return hasPermission || children.length > 0;
            })
            .map(menu => ({
                ...menu,
                children: this.filterMenuTree(menu.children, allowedMenuIds),
            }));
    }
}