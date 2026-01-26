import { Module, forwardRef } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/auth/users/users.module';
@Module({
  imports: [forwardRef(() => AuthModule), UsersModule],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
