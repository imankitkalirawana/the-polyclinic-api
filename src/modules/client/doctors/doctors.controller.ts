import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { BearerAuthGuard } from '../../common/auth/guards/bearer-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/auth/decorators/current-user.decorator';
import { formatDoctor } from './doctors.helper';
import { Request } from 'express';

@Controller('client/doctors')
@UseGuards(BearerAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findAll(@Query('search') search?: string) {
    return this.doctorsService.findAll(search);
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.doctorsService.findByUserId(user.userId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const doctor = await this.doctorsService.findOne(id);
    return formatDoctor(doctor, req.user.role);
  }
}
