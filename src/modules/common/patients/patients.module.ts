import { Module, Scope } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { User } from '../users/entities/user.entity';
import { UserTenant } from '../users/entities/user-tenant.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, User, UserTenant, Tenant]),
    AuthModule,
  ],
  controllers: [PatientsController],
  providers: [
    {
      provide: PatientsService,
      useClass: PatientsService,
      scope: Scope.REQUEST,
    },
  ],
  exports: [PatientsService, TypeOrmModule],
})
export class PatientsModule {}
