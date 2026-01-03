import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { BaseTenantService } from '../../tenancy/base-tenant.service';
import { CONNECTION } from '../../tenancy/tenancy.symbols';
import { TenantAuthInitService } from '../../tenancy/tenant-auth-init.service';
import { Doctor } from './entities/doctor.entity';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { Role } from 'src/common/enums/role.enum';

const doctorSelect = [
  'doctor.id AS id',
  'doctor.specialization AS specialization',
  'doctor.designation AS designation',
  'doctor.departments AS departments',
  'doctor.experience AS experience',
  'doctor.education AS education',
  'doctor.biography AS biography',
  'doctor.seating AS seating',
];

const userSelect = [
  'user.id AS userId',
  'user.email AS email',
  'user.name AS name',
  'user.image AS image',
  'user.phone AS phone',
];

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

  private getUserRepository() {
    return this.getRepository(TenantUser);
  }

  async create(createDoctorDto: CreateDoctorDto) {
    await this.ensureTablesExist();
    const doctorRepository = this.getDoctorRepository();
    const userRepository = this.getUserRepository();

    const user = await userRepository.findOne({
      where: { id: createDoctorDto.userId },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createDoctorDto.userId} not found`,
      );
    }

    const existingDoctor = await doctorRepository.findOne({
      where: { userId: createDoctorDto.userId },
      relations: ['user'],
    });

    if (existingDoctor) {
      throw new ConflictException(
        `Doctor record already exists for "${existingDoctor.user.name}"`,
      );
    }

    const doctor = doctorRepository.create(createDoctorDto);

    if (user.role !== Role.DOCTOR) {
      user.role = Role.DOCTOR;
      await userRepository.save(user);
    }

    const savedDoctor = await doctorRepository.save(doctor);

    const doctorWithUser = await doctorRepository
      .createQueryBuilder('doctor')
      .leftJoin('doctor.user', 'user')
      .select([...doctorSelect, ...userSelect])
      .where('doctor.id = :id', { id: savedDoctor.id })
      .getRawOne();

    if (!doctorWithUser) {
      throw new NotFoundException('Failed to retrieve created doctor');
    }

    return {
      message: 'Doctor created successfully',
      data: doctorWithUser,
    };
  }

  async findAll(search?: string) {
    await this.ensureTablesExist();
    const doctorRepository = this.getDoctorRepository();
    const doctors = await doctorRepository
      .createQueryBuilder('doctor')
      .leftJoin('doctor.user', 'user')
      .select([...doctorSelect, ...userSelect])
      .where(
        'user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search',
        {
          search: `%${search}%`,
        },
      )
      .orderBy('user.name', 'ASC')
      .limit(10)
      .getRawMany();

    return doctors;
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

    const doctor = await doctorRepository
      .createQueryBuilder('doctor')
      .leftJoin('doctor.user', 'user')
      .select([...doctorSelect, ...userSelect])
      .where('doctor.userId = :userId', { userId })
      .getRawOne();

    if (!doctor) {
      throw new NotFoundException(`Doctor with user ID ${userId} not found`);
    }

    return doctor;
  }

  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    await this.ensureTablesExist();
    const doctorRepository = this.getDoctorRepository();

    const doctor = await doctorRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    if (updateDoctorDto.userId) {
      const userRepository = this.getUserRepository();
      const user = await userRepository.findOne({
        where: { id: updateDoctorDto.userId },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateDoctorDto.userId} not found`,
        );
      }

      const existingDoctor = await doctorRepository.findOne({
        where: { userId: updateDoctorDto.userId },
      });

      if (existingDoctor && existingDoctor.id !== id) {
        throw new ConflictException(
          'Another doctor record already exists for this user',
        );
      }

      if (user.role !== Role.DOCTOR) {
        user.role = Role.DOCTOR;
        await userRepository.save(user);
      }
    }

    Object.assign(doctor, updateDoctorDto);
    const updatedDoctor = await doctorRepository.save(doctor);

    const doctorWithUser = await doctorRepository
      .createQueryBuilder('doctor')
      .leftJoin('doctor.user', 'user')
      .select([...doctorSelect, ...userSelect])
      .where('doctor.id = :id', { id: updatedDoctor.id })
      .getRawOne();

    if (!doctorWithUser) {
      throw new NotFoundException('Failed to retrieve updated doctor');
    }

    return {
      message: 'Doctor updated successfully',
      data: doctorWithUser,
    };
  }

  async remove(id: string) {
    await this.ensureTablesExist();
    const doctorRepository = this.getDoctorRepository();

    const doctor = await doctorRepository.findOne({
      where: { id },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    await doctorRepository.remove(doctor);

    return {
      message: 'Doctor deleted successfully',
    };
  }
}
