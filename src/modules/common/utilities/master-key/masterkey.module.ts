import { Module } from '@nestjs/common';
import { MasterKeyService } from './masterkey.service';
import { MasterKeyEntity } from './entities/masterkey.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterKeyController } from './masterkey.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MasterKeyEntity])],
  controllers: [MasterKeyController],
  providers: [MasterKeyService],
  exports: [MasterKeyService],
})
export class MasterKeyModule {}
