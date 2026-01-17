import { Controller, Get, Query, Req } from '@nestjs/common';
import { ActivityLogService } from './services/activity-log.service';
import { EntityType } from './enums/entity-type.enum';
import { Request } from 'express';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('logs')
  async getActivityLogs(
    @Query('type') type: EntityType,
    @Query('id') id: string,
  ) {
    return this.activityLogService.getActivityLogsByEntity(type, id);
  }

  //   get by me
  @Get('logs/my')
  async getActivityLogsByStakeholder(@Req() req: Request) {
    return this.activityLogService.getActivityLogsByStakeholder(
      req.user?.userId,
    );
  }
}
