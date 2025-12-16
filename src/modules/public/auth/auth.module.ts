import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BearerStrategy } from './strategies/bearer.strategy';
import { PublicUser } from './entities/public-user.entity';
import { Session } from './entities/session.entity';
import { Otp } from './entities/otp.entity';
import { RolesGuard } from './guards/roles.guard';
import { FieldRestrictionsGuard } from './guards/field-restrictions.guard';
import { SessionCleanupService } from './session-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublicUser, Session, Otp], 'default'),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    BearerStrategy,
    RolesGuard,
    FieldRestrictionsGuard,
    SessionCleanupService,
  ],
  exports: [AuthService, BearerStrategy, RolesGuard, FieldRestrictionsGuard],
})
export class AuthModule {}
