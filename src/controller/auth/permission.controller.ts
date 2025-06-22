import { Controller, Post, Body, Get, Param, Del, Inject } from '@midwayjs/core';
import { PermissionService } from '../../service/auth/permission.service';


@Controller('/api/permissions')
export class PermissionController {
    @Inject()
    permissionService: PermissionService;


    @Post('/')
    async createOrUpdatePermission(@Body() data: {
        userId?: string;
        roleId?: string;
        menuId: string;
        actions: string[];
        dataScope?: string;
    }[]) {
        return this.permissionService.createOrUpdatePermissions(data);
    }

    @Del('/:id')
    async deletePermission(@Param('id') id: string) {
        return this.permissionService.deletePermission(id);
    }


    @Get('/:id')
    async getPermission(@Param('id') id: string) {
        return this.permissionService.getPermissionById(id);
    }

    @Get('/')
    async getPermissions() {
        return this.permissionService.getPermissions();
    }


    @Get('/user/:userId')
    async getUserPermissions(@Param('userId') userId: string) {
        return this.permissionService.getUserPermissions(userId);
    }

    @Get('/role/:roleId')
    async getRolePermissions(@Param('roleId') roleId: string) {
        return this.permissionService.getRolePermissions(roleId);
    }
}