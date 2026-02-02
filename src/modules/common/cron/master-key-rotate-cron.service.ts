import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MasterKeyService } from '@/common/utilities/master-key/masterkey.service';

@Injectable()
export class MasterKeyRotateCronService {
  private readonly logger = new Logger(MasterKeyRotateCronService.name);

  constructor(private readonly masterKeyService: MasterKeyService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    try {
      await this.masterKeyService.rotateGlobalMasterKey();
      this.logger.log('Master key generated');
    } catch (error) {
      this.logger.error(
        `Master key rotation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
