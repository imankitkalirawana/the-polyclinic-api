import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { Company } from './entities/company.entity';
import { UsersModule } from './users/users.module';
import { CompanyModule } from './companies/company.module';
import { SchemaValidatorService } from './schema/schema-validator.service';
import { GlobalBearerStrategy } from './strategies/bearer.strategy';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, Company]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    UsersModule,
    CompanyModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
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
