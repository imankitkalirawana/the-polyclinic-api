import { Controller, Get, Query, ParseEnumPipe } from '@nestjs/common';
import { ActivityLogService } from './services/activity-log.service';
import { EntityType } from './enums/entity-type.enum';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('logs')
  async getActivityLogs(
    @Query('type', new ParseEnumPipe(EntityType)) type: EntityType,
    @Query('id') id: string,
  ) {
    return this.activityLogService.getActivityLogsByEntity(type, id);
  }
}
