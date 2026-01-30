import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { BearerAuthGuard } from '@/auth/guards/bearer-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@/auth/decorators/current-user.decorator';

@Controller('client/doctors')
@UseGuards(BearerAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  async findAll(@Query('search') search?: string) {
    return this.doctorsService.findAll(search);
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.doctorsService.findByUserId(user.user_id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }
}
