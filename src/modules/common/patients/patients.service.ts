import {
  Injectable,
  NotFoundException,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { ArrayContains } from 'typeorm';
import { CreatePatientDto } from './dto/create-patient.dto';
import { getTenantConnection } from 'src/common/db/tenant-connection';
import { subYears } from 'date-fns';
import { UsersService } from '@/auth/users/users.service';
import { Patient } from '@/common/patients/entities/patient.entity';
import { Role } from 'src/scripts/types';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  private readonly schema: string;

  constructor(
    @Inject(REQUEST) private request: Request,
    private readonly usersService: UsersService,
  ) {
    this.schema = this.request.schema;
  }

  private async getConnection() {
    return await getTenantConnection(this.schema);
  }

  private async getPatientRepository() {
    const connection = await this.getConnection();
    return connection.getRepository(Patient);
  }

  private getActor() {
    const actor = this.request?.user;
    return {
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
    };
  }

  private calculateDob(age: number): Date {
    const currentDate = new Date();
    const dob = subYears(currentDate, age);
    return dob;
  }

  private async findPatientEntityByUserId(userId: string) {
    const repo = await this.getPatientRepository();
    return await repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });
  }

  async checkPatientExists(patientId: string, earlyReturn?: boolean) {
    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.findOne({
      where: {
        id: patientId,
        user: {
          companies: ArrayContains([this.schema]),
        },
      },
    });

    if (earlyReturn && !patient) {
      throw new NotFoundException('Patient not found');
    }

    return {
      exists: !!patient,
      patient,
    };
  }

  async checkPatientExistsByEmail(email: string, earlyReturn?: boolean) {
    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.findOne({
      where: {
        user: {
          email,
          companies: ArrayContains([this.schema]),
        },
      },
    });

    if (earlyReturn && patient) {
      throw new ConflictException('Patient with this email already exists');
    }

    return {
      exists: !!patient,
      patient,
    };
  }

  async create(createPatientDto: CreatePatientDto) {
    const user = await this.usersService.create({
      email: createPatientDto.email,
      name: createPatientDto.name,
      phone: createPatientDto.phone,
      password: createPatientDto.password,
      role: Role.PATIENT,
      companies: [this.schema],
    });

    const patientRepository = await this.getPatientRepository();
    const patient = await patientRepository.save({
      user_id: user.id,
      gender: createPatientDto.gender,
      dob: createPatientDto.dob,
      address: createPatientDto.address,
    });

    return patient;
  }

  async findAll(search?: string) {
    const repo = await this.getPatientRepository();
    const baseWhere = {
      user: { companies: ArrayContains([this.schema]) },
    };

    if (search?.trim()) {
      const term = `%${search.trim()}%`;

      return repo
        .createQueryBuilder('patient')
        .leftJoinAndSelect('patient.user', 'user')
        .where('user.companies @> :companies', {
          companies: [this.schema],
        })
        .andWhere(
          `(user.name ILIKE :term 
            OR user.email ILIKE :term 
            OR user.phone ILIKE :term)`,
        )
        .setParameter('term', term)
        .getMany();
    }
    const patients = await repo.find({
      where: baseWhere,
      relations: ['user'],
    });
    return patients;
  }

  async findByUserId(userId: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  async findOne(id: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { id, user: { companies: ArrayContains([this.schema]) } },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  // find one by user email
  async findOneByUserEmail(email: string) {
    const repo = await this.getPatientRepository();
    const patient = await repo.findOne({
      where: { user: { email, companies: ArrayContains([this.schema]) } },
      relations: ['user'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto) {
    const repo = await this.getPatientRepository();
    const updatedPatient = await repo.update(id, updatePatientDto);

    if (updatedPatient.affected === 0) {
      throw new NotFoundException('Patient not found');
    }

    return this.findOne(id);
  }

  async remove(_patientId: string) {}

  async restore(_patientId: string) {}
}
