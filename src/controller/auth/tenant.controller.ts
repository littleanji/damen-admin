// src/controller/tenant.controller.ts
import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { TenantService } from '../../service/auth/tenant.service';


@Controller('/api/tenant')
export class TenantController {
    @Inject()
    tenantService: TenantService;


    @Post('/')
    async createTenant(@Body() data: any) {
        return this.tenantService.createTenant(data);
    }

    @Put('/')
    async updateTenant(@Body() data: any) {
        return this.tenantService.updateTenant(data);
    }


    @Del('/:id')
    async deleteTenant(@Param('id') id: string) {
        return this.tenantService.deleteTenant(id);
    }


    @Get('/:id')
    async getTenant(@Param('id') id: string) {
        return this.tenantService.getTenantById(id);
    }

    @Get('/')
    async getTenants(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('isActive') isActive?: boolean
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        console.log(start, end);

        return this.tenantService.getTenants({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end,
            isActive
        });
    }
}