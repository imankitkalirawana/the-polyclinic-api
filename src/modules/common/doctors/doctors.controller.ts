import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { BearerAuthGuard } from '@/auth/guards/bearer-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@/auth/decorators/current-user.decorator';
import { formatDoctor } from './doctors.helper';
import { Request } from 'express';

@Controller('doctors')
@UseGuards(BearerAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  async findAll(@Req() req: Request, @Query('search') search?: string) {
    const doctors = await this.doctorsService.findAll(search);
    return doctors.map((doctor) => formatDoctor(doctor, req.user.role));
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.doctorsService.findByUserId(user.user_id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const doctor = await this.doctorsService.findOne(id);
    return formatDoctor(doctor, req.user.role);
  }
}
