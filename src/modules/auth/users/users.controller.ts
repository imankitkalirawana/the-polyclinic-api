import { Controller, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { BearerAuthGuard } from '../../public/auth/guards/bearer-auth.guard';
import { RolesGuard } from '../../public/auth/guards/roles.guard';
import { FieldRestrictionsGuard } from '../../public/auth/guards/field-restrictions.guard';

@Controller('users')
@UseGuards(BearerAuthGuard, RolesGuard, FieldRestrictionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
