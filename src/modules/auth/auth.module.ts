import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { Company } from './entities/company.entity';
import { Verification } from './entities/verification.entity';
import { VerificationService } from './verification.service';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './companies/company.module';
import { SchemaValidatorService } from './schema/schema-validator.service';
import { GlobalBearerStrategy } from './strategies/bearer.strategy';
import { RolesGuard } from './guards/roles.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { DoctorsModule } from '@/common/doctors/doctors.module';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 10 * 60000, // 10 minutes
        limit: 3,
      },
    ]),
    TypeOrmModule.forFeature([User, Session, Company, Verification]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    UsersModule,
    CompanyModule,
    DoctorsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    VerificationService,
    SchemaValidatorService,
    GlobalBearerStrategy,
    RolesGuard,
  ],
  exports: [
    AuthService,
    SchemaValidatorService,
    GlobalBearerStrategy,
    RolesGuard,
  ],
})
export class AuthModule {}
