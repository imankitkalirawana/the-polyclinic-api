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
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { formatPatient } from './patients.helper';

@Controller('patients')
@UseGuards(BearerAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  async create(
    @Body() createPatientDto: CreatePatientDto,
    @StandardParam() params: StandardParams,
  ) {
    const patient = await this.patientsService.create(createPatientDto);
    params.setMessage('Patient created successfully');
    return formatPatient(patient);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findAll(@Query('search') search?: string) {
    return this.patientsService.findAll(search);
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const patient = await this.patientsService.findByUserId(user.userId);
    return formatPatient(patient);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string) {
    const patient = await this.patientsService.findOne(id);
    return formatPatient(patient);
  }

  @Get('user/:userId')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findByUserId(@Param('userId') userId: string) {
    const patient = await this.patientsService.findByUserId(userId);
    return formatPatient(patient);
  }

  @Patch(':userId')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  async update(
    @Param('userId') userId: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @StandardParam() params: StandardParams,
  ) {
    const patient = await this.patientsService.update(userId, updatePatientDto);
    params.setMessage('Patient updated successfully');
    return formatPatient(patient);
  }

  @Delete(':userId')
  @Roles(Role.ADMIN)
  async remove(
    @Param('userId') userId: string,
    @StandardParam() params: StandardParams,
  ) {
    await this.patientsService.remove(userId);
    params.setMessage('Patient removed successfully');
    return null;
  }

  @Patch(':userId/restore')
  @Roles(Role.ADMIN)
  async restore(
    @Param('userId') userId: string,
    @StandardParam() params: StandardParams,
  ) {
    await this.patientsService.restore(userId);
    params.setMessage('Patient restored successfully');
    return null;
  }
}
