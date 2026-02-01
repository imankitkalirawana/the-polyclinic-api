import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { ArrayContains, Repository } from 'typeorm';
import { Doctor } from '@/common/doctors/entities/doctor.entity';
import { formatDoctor } from './doctors.helper';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { getTenantConnection } from 'src/common/db/tenant-connection';

import { UsersService } from '@/auth/users/users.service';

@Injectable()
export class DoctorsService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly usersService: UsersService,
  ) {}

  private async getConnection() {
    return await getTenantConnection(this.request.schema);
  }

  private async getDoctorRepository(): Promise<Repository<Doctor>> {
    const connection = await this.getConnection();
    return connection.getRepository(Doctor);
  }

  private getActor() {
    const actor = this.request?.user;
    return {
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
    };
  }

  async findAll(search?: string) {
    const repo = await this.getDoctorRepository();
    const baseWhere = {
      user: { companies: ArrayContains([this.request.schema]) },
    };

    if (search?.trim()) {
      const term = `%${search.trim()}%`;

      return repo
        .createQueryBuilder('doctor')
        .leftJoinAndSelect('doctor.user', 'user')
        .where('user.companies @> :companies', {
          companies: [this.request.schema],
        })
        .andWhere(
          `(user.name ILIKE :term 
            OR user.email ILIKE :term 
            OR user.phone ILIKE :term)`,
        )
        .setParameter('term', term)
        .getMany();
    }
    const doctors = await repo.find({
      where: baseWhere,
      relations: ['user'],
    });
    return doctors;
  }

  async findOne(id: string) {
    const doctorRepository = await this.getDoctorRepository();
    const doctor = await doctorRepository.findOne({
      where: {
        id,
        user: {
          companies: ArrayContains([this.request.schema]),
        },
      },
      relations: ['user'],
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async findByUserId(userId: string) {
    const doctorRepository = await this.getDoctorRepository();
    const doctor = await doctorRepository.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return formatDoctor(doctor, this.request.user.role);
  }

  // update doctor
  async update(_userId: string, _updateDoctorDto: UpdateDoctorDto) {}
}
