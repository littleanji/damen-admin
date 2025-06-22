import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { RoleService } from '../../service/auth/role.service';


@Controller('/api/role')
export class RoleController {
    @Inject()
    roleService: RoleService;


    @Post('/')
    async createRole(@Body() data: any) {
        return this.roleService.createRole(data);
    }


    @Put('/')
    async updateRole(@Body() data: any) {
        return this.roleService.updateRole(data);
    }


    @Del('/:id')
    async deleteRole(@Param('id') id: string) {
        return this.roleService.deleteRole(id);
    }


    @Get('/:id')
    async getRole(@Param('id') id: string) {
        return this.roleService.getRoleById(id);
    }

    @Get('/')
    async getRoles(
        @Query('page') page: number,
        @Query('pageSize') pageSize: number,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.roleService.getRoles({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end
        });
    }
}