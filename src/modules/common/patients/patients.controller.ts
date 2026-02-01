import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { BearerAuthGuard } from '@/auth/guards/bearer-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@/auth/decorators/current-user.decorator';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { CreatePatientDto } from './dto/create-patient.dto';
import { formatPatient } from './patients.helper';
import { UsersService } from '@/auth/users/users.service';

@Controller('patients')
@UseGuards(BearerAuthGuard, RolesGuard)
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST)
  async create(
    @Body() createPatientDto: CreatePatientDto,
    @StandardParam() params: StandardParams,
  ) {
    params.setMessage(`Patient created successfully`);

    return this.patientsService.create(createPatientDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  async findAll(@Query('search') search?: string) {
    const patients = await this.patientsService.findAll(search);
    return patients.map(formatPatient);
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const patient = await this.patientsService.findByUserId(user.user_id);
    return formatPatient(patient);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string) {
    const patient = await this.patientsService.findOne(id);
    return formatPatient(patient);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    return await this.patientsService.remove(id);
  }
}
