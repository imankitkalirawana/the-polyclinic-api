import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { BearerAuthGuard } from '../guards/bearer-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { FieldRestrictionsGuard } from '../guards/field-restrictions.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { ResetPasswordDto } from '../dto/reset-password-dto';

@Controller('users')
@UseGuards(BearerAuthGuard, RolesGuard, FieldRestrictionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async create(
    @StandardParam() params: StandardParams,
    @Body() dto: CreateUserDto,
  ) {
    const user = await this.usersService.create(dto);
    params.setMessage('User created successfully');
    return user;
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR)
  async findAll() {
    return await this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR)
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, dto);
    params.setMessage('User updated successfully');
    return user;
  }

  // reset password
  @Post(':id/reset-password')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async resetPassword(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.updatePassword(id, dto.password);
    params.setMessage('Password reset successfully');
    return null;
  }
}
