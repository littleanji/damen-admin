import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { JwtService } from '@midwayjs/jwt';
import { UserService } from '../../service/auth/user.service';
import { AuthService } from '../../service/auth/auth.service';
import { PasswordUtil } from '../../utils/passwordUtil';
import { TenantService } from '../../service/auth/tenant.service';
import { BusinessError } from '../../common/error';


@Controller('/api/auth')
export class AuthController {
    @Inject()
    userService: UserService;

    @Inject()
    authService: AuthService;

    @Inject()
    tenantService: TenantService;

    @Inject()
    jwtService: JwtService;


    @Post('/login')
    async login(
        @Body() body: any
    ) {
        const { tenantCode, userName, passWord } = body;

        let tenant: any | null = null

        if (tenantCode) {

            tenant = await this.tenantService.getTenantByCode(tenantCode);

            if (tenant) await this.tenantService.checkTenantStatus();
        }

        const tenantId = tenant ? tenant.id : null;

        const user = await this.userService.findUserByUsername(tenantId, userName);

        if (!user) {
            throw new BusinessError('用户不存在');
        }

        const passwordMatch = await PasswordUtil.compare(passWord, user.password);

        if (!passwordMatch) {
            throw new BusinessError('密码错误');
        }

        if (!user.isActive) {
            throw new BusinessError('用户已被禁用');
        }

        const data = {
            id: user.id,
            lastLoginAt: new Date()
        }

        this.userService.updateUser(data);

        const token = await this.jwtService.sign({
            userId: user.id,
            tenantId: user.tenantId
        });

        delete user.password;

        return {
            token,
            userId: user.id
        };
    }

}