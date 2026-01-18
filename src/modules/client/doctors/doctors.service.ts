import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { DataSource, ILike } from 'typeorm';
import { BaseTenantService } from '../../tenancy/base-tenant.service';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { Doctor } from './entities/doctor.entity';
import { formatDoctor } from './doctors.helper';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService extends BaseTenantService {
  constructor(
    @Inject(REQUEST) request: Request,
    @Inject(CONNECTION) connection: DataSource | null,
    tenantAuthInitService: TenantAuthInitService,
  ) {
    super(request, connection, tenantAuthInitService, DoctorsService.name);
  }

  private getDoctorRepository() {
    return this.getRepository(Doctor);
  }

  async create(createDoctorDto: CreateDoctorDto) {
    if (!createDoctorDto.userId) {
      throw new BadRequestException('User ID is required to create a doctor');
    }

    const doctor = this.getDoctorRepository().create(createDoctorDto);
    return await this.getDoctorRepository().save(doctor);
  }

  async findAll(search?: string) {
    await this.ensureTablesExist();

    const doctorRepository = this.getDoctorRepository();
    const doctors = await doctorRepository.find({
      relations: ['user'],
      where: search
        ? [
            { user: { name: ILike(`%${search}%`) } },
            { designation: ILike(`%${search}%`) },
            { seating: ILike(`%${search}%`) },
          ]
        : {},
    });

    return doctors.map((doctor) =>
      formatDoctor(doctor, this.request.user.role),
    );
  }

  async findOne(id: string) {
    await this.ensureTablesExist();
    const doctorRepository = this.getDoctorRepository();

    const doctor = await doctorRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }

  async findByUserId(userId: string) {
    await this.ensureTablesExist();
    const doctorRepository = this.getDoctorRepository();

    const doctor = await doctorRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with user ID ${userId} not found`);
    }

    return doctor;
  }

  // update doctor
  async update(userId: string, updateDoctorDto: UpdateDoctorDto) {
    const doctorRepository = this.getDoctorRepository();
    const doctor = await doctorRepository.findOne({
      where: { userId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with user ID ${userId} not found`);
    }
    Object.assign(doctor, updateDoctorDto);
    return await doctorRepository.save(doctor);
  }
}
