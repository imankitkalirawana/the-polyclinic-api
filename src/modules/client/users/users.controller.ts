import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BearerAuthGuard } from '../auth/guards/bearer-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { AllowFields } from '@/public/auth/decorators/allow-fields.decorator';
import { RestrictFields } from '@/public/auth/decorators/restrict-fields.decorator';
import { FieldRestrictionsGuard } from '@/public/auth/guards/field-restrictions.guard';
import { PatientsService } from '../patients/patients.service';
import { DoctorsService } from '../doctors/doctors.service';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { formatLabel } from 'src/common/utils/text-transform.util';

@Controller('client/users')
@UseGuards(BearerAuthGuard, RolesGuard, FieldRestrictionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly doctorsService: DoctorsService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(
    @StandardParam() params: StandardParams,
    @Body() createUserDto: CreateUserDto,
  ) {
    const user = await this.usersService.create(createUserDto);
    createUserDto.userId = user.id;

    if (createUserDto.role === Role.PATIENT) {
      await this.patientsService.create(createUserDto);
    }
    if (createUserDto.role === Role.DOCTOR) {
      await this.doctorsService.create(createUserDto);
    }

    params.setMessage(
      `${formatLabel(createUserDto.role)} created successfully`,
    );
    return user;
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findOne(user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  @AllowFields({
    role: [Role.DOCTOR],
    fields: ['name'],
  })
  @RestrictFields({
    role: [Role.DOCTOR],
    fields: ['email', 'role'],
  })
  async update(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.role === Role.DOCTOR) {
      await this.doctorsService.update(id, updateUserDto);
    }

    if (user.role === Role.PATIENT) {
      await this.patientsService.update(id, updateUserDto);
    }

    params.setMessage(`${formatLabel(user.role)} updated successfully`);
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
  }
}
