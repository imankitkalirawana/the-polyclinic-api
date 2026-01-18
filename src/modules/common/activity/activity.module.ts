import { Global, Module, Scope } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityService } from './services/activity.service';
import { ActivityLogService } from './services/activity-log.service';
import { ActivityListener } from './listeners/activity.listener';
import { TenancyModule } from '@/tenancy/tenancy.module';
import { ActivityController } from './activity.controller';
import { User } from '../users/entities/user.entity';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([ActivityLog, User]),
    TenancyModule,
  ],
  providers: [
    {
      provide: ActivityService,
      useClass: ActivityService,
      scope: Scope.REQUEST,
    },
    {
      provide: ActivityLogService,
      useClass: ActivityLogService,
      scope: Scope.REQUEST,
    },
    ActivityListener,
  ],
  controllers: [ActivityController],
  exports: [ActivityService, ActivityLogService],
})
export class ActivityModule {}
