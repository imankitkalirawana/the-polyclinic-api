import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FieldRestrictionsGuard } from '../auth/guards/field-restrictions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { AllowFields } from '../auth/decorators/allow-fields.decorator';
import { RestrictFields } from '../auth/decorators/restrict-fields.decorator';
import { Role } from 'src/common/enums/role.enum';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { formatLabel } from 'src/common/utils/text-transform.util';
import { formatUser } from './users.helper';

@Controller('users')
@UseGuards(BearerAuthGuard, RolesGuard, FieldRestrictionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async create(
    @StandardParam() params: StandardParams,
    @Body() createUserDto: CreateUserDto,
    @Req() req: Request,
  ) {
    const user = await this.usersService.create(createUserDto);
    params.setMessage(`${formatLabel(user.role)} created successfully`);
    return formatUser(user, req.user.role);
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
    const foundUser = await this.usersService.findOne(user.userId);
    return formatUser(foundUser, req.user.role);
  }

  @Get()
  @Roles(
    Role.ADMIN,
    Role.SUPERADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  async findAll(@Query() queryDto: QueryUserDto) {
    return this.usersService.findAll(queryDto);
  }

  @Get('tenant/:tenantSlug')
  @Roles(
    Role.ADMIN,
    Role.SUPERADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  async findByTenant(
    @Param('tenantSlug') tenantSlug: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findUsersByTenantSlug(tenantSlug, search);
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.SUPERADMIN,
    Role.DOCTOR,
    Role.NURSE,
    Role.RECEPTIONIST,
  )
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post(':id/add-to-tenant/:tenantSlug')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async addToTenant(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Param('tenantSlug') tenantSlug: string,
  ) {
    await this.usersService.addUserToTenantBySlug(id, tenantSlug);
    params.setMessage('User added to tenant successfully');
    return null;
  }

  @Delete(':id/remove-from-tenant/:tenantId')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async removeFromTenant(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Param('tenantId') tenantId: string,
  ) {
    await this.usersService.removeUserFromTenant(id, tenantId);
    params.setMessage('User removed from tenant successfully');
    return null;
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async resetPassword(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() { password }: { password: string },
  ) {
    await this.usersService.resetPassword(id, password);
    params.setMessage('Password reset successfully');
    return null;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.DOCTOR)
  @AllowFields({
    role: [Role.DOCTOR],
    fields: ['name', 'phone', 'image'],
  })
  @RestrictFields({
    role: [Role.DOCTOR],
    fields: ['email', 'role', 'status'],
  })
  async update(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    params.setMessage(`${formatLabel(user.role)} updated successfully`);
    return formatUser(user, req.user.role);
  }

  @Delete(':id/soft-remove')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async softRemove(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
  ) {
    await this.usersService.softRemove(id);
    params.setMessage('User removed successfully');
    return null;
  }

  @Patch(':id/restore')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async restore(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
  ) {
    await this.usersService.restore(id);
    params.setMessage('User restored successfully');
    return null;
  }

  @Delete(':id/delete')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  async remove(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
  ) {
    await this.usersService.remove(id);
    params.setMessage('User deleted successfully');
    return null;
  }
}
