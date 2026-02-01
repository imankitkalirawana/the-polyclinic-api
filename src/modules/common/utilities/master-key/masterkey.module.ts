import { Module } from '@nestjs/common';
import { MasterKeyService } from './masterkey.service';
import { SlackModule } from '@/common/slack/slack.module';
import { MasterKeySchema } from './schemas/masterkey.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { MasterKey } from './schemas/masterkey.schema';

@Module({
  imports: [
    SlackModule,
    MongooseModule.forFeature([
      { name: MasterKey.name, schema: MasterKeySchema },
    ]),
  ],
  providers: [MasterKeyService],
  exports: [MasterKeyService],
})
export class MasterKeyModule {}
