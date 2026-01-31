import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsUUID } from 'class-validator';
import { ActivityLogService } from './services/activity-log.service';
import { EntityType } from './enums/entity-type.enum';
import { Request } from 'express';
import { BearerAuthGuard } from '@/auth/guards/bearer-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

class GetActivityLogsQueryDto {
  @IsEnum(EntityType)
  type: EntityType;

  @IsUUID()
  id: string;
}

@Controller('activity')
@UseGuards(BearerAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('logs')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async getActivityLogs(@Query() query: GetActivityLogsQueryDto) {
    return this.activityLogService.getActivityLogsByEntity(
      query.type,
      query.id,
    );
  }

  @Get('logs/my')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  async getActivityLogsByStakeholder(@Req() req: Request) {
    return this.activityLogService.getActivityLogsByStakeholder(
      req.user?.userId,
    );
  }
}
