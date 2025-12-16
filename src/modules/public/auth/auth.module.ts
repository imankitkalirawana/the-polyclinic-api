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
import { RolesGuard } from './guards/roles.guard';
import { SessionCleanupService } from './session-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublicUser, Session], 'default'),
    PassportModule,
    JwtModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [AuthService, BearerStrategy, RolesGuard, SessionCleanupService],
  exports: [AuthService, BearerStrategy, RolesGuard],
})
export class AuthModule {}

