import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { MenuService } from '../../service/auth/menu.service';


@Controller('/api/menu')
export class MenuController {
    @Inject()
    menuService: MenuService;


    @Post('/')
    async createMenu(@Body() data: any) {
        return this.menuService.createMenu(data);
    }


    @Put('/')
    async updateMenu(@Body() data: any) {
        return this.menuService.updateMenu(data);
    }

    @Del('/:id')
    async deleteMenu(@Param('id') id: string) {
        return this.menuService.deleteMenu(id);
    }


    @Get('/:id')
    async getMenu(@Param('id') id: string) {
        return this.menuService.getMenuById(id);
    }


    @Get('/')
    async getMenus(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('parentId') parentId?: string
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.menuService.getMenus({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end,
            parentId
        });
    }


    @Get('/tree')
    async getMenuTree() {
        return this.menuService.getMenuTree();
    }
}