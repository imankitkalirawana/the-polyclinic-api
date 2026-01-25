import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
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
import { formatUser } from './users.helper';

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
    @Req() req: Request,
  ) {
    const user = await this.usersService.create(createUserDto);
    createUserDto.userId = user.id;

    let linkedId: string | null = null;

    if (createUserDto.role === Role.PATIENT) {
      const patient = await this.patientsService.create(createUserDto);
      linkedId = patient.id;
    }
    if (createUserDto.role === Role.DOCTOR) {
      const doctor = await this.doctorsService.create(createUserDto);
      linkedId = doctor.id;
    }

    params.setMessage(
      `${formatLabel(createUserDto.role)} created successfully`,
    );
    return { ...formatUser(user, req.user.role), linked_id: linkedId };
  }

  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
    return formatUser(
      await this.usersService.findOne(user.userId),
      req.user.role,
    );
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

  @Post('/:id/reset-password')
  @Roles(Role.ADMIN)
  async resetPassword(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() { password }: { password: string },
  ) {
    await this.usersService.resetPassword(id, password);
    params.setMessage(`Password reset successfully`);
    return null;
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
    @Req() req: Request,
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

    params.setMessage(`${formatLabel(user.role as Role)} updated successfully`);
    const updatedUser = await this.usersService.findOne(id);

    return formatUser(updatedUser, req.user.role);
  }

  @Delete(':id/soft-remove')
  @Roles(Role.ADMIN)
  async softRemove(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
  ) {
    await this.usersService.softRemove(id);
    params.setMessage(`User removed successfully`);
    return null;
  }

  @Patch(':id/restore')
  @Roles(Role.ADMIN)
  async restore(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
  ) {
    await this.usersService.restore(id);
    params.setMessage(`User restored successfully`);
    return null;
  }

  @Delete(':id/delete')
  @Roles(Role.ADMIN)
  async remove(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
  ) {
    await this.usersService.remove(id);
    params.setMessage(`User removed successfully`);
    return null;
  }
}
