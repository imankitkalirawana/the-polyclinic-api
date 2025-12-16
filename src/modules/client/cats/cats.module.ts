import { Module } from '@nestjs/common';
import { CatsService } from './cats.service';
import { CatsController } from './cats.controller';
import { TenancyModule } from '../../tenancy/tenancy.module';

@Module({
  imports: [TenancyModule],
  controllers: [CatsController],
  providers: [CatsService],
})
export class CatsModule {}
