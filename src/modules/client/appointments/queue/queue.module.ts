import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { PaymentsModule } from '../../payments/payments.module';
import { PdfModule } from '../../pdf/pdf.module';
import { DoctorsModule } from '../../doctors/doctors.module';
import { QrModule } from '../../qr/qr.module';
import { PatientsModule } from '@/client/patients/patients.module';

@Module({
  imports: [PaymentsModule, PdfModule, DoctorsModule, QrModule, PatientsModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
