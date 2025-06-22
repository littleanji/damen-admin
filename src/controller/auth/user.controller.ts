// src/controller/user.controller.ts
import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { UserService } from '../../service/auth/user.service';
import { AuthService } from '../../service/auth/auth.service';


@Controller('/api/user')
export class UserController {
    @Inject()
    userService: UserService;

    @Inject()
    authService: AuthService;


    @Post('/')
    async createUser(@Body() data: any) {
        return this.userService.createUser(data);
    }


    @Put('/')
    async updateUser(@Body() data: any) {
        return this.userService.updateUser(data);
    }


    @Del('/:id')
    async deleteUser(@Param('id') id: string) {
        return this.userService.deleteUser(id);
    }


    @Get('/:id')
    async getUser(@Param('id') id: string) {
        return this.userService.getUserById(id);
    }

    @Put('/updateUserRoles')
    async updateUserRoles(
        @Body() body: {
            id: string;
            roleIds?: string[]
        }
    ) {
        return this.userService.updateUserRoles(body);
    }


    @Get('/')
    async getUsers(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('isAdmin') isAdmin?: boolean,
        @Query('haveRole') haveRole?: boolean
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.userService.getUsers({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end,
            isAdmin,
        });
    }

    @Get('/:id/menus')
    async getUserMenus(@Param('id') id: string) {
        return this.authService.getUserMenuTree(id);
    }
}