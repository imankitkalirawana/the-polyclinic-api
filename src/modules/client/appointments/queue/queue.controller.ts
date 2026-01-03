import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { UpdateQueueDto } from './dto/update-queue.dto';
import { BearerAuthGuard } from '../../auth/guards/bearer-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FieldRestrictionsGuard } from '@/public/auth/guards/field-restrictions.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../auth/decorators/current-user.decorator';
import { CompleteQueueDto } from './dto/compelete-queue.dto';
import { VerifyPaymentDto } from '@/client/payments/dto/verify-payment.dto';
import { Response } from 'express';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { PaymentMode } from './enums/queue.enum';

@Controller('client/appointments/queue')
@UseGuards(BearerAuthGuard, RolesGuard, FieldRestrictionsGuard)
export class QueueController {
  private readonly logger = new Logger(QueueController.name);
  constructor(private readonly queueService: QueueService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  async create(
    @StandardParam() params: StandardParams,
    @Body() createQueueDto: CreateQueueDto,
  ) {
    let queue = null;
    if (createQueueDto.queueId) {
      queue = await this.queueService.findOne(createQueueDto.queueId);
    } else {
      queue = await this.queueService.create(createQueueDto);
    }

    params.setMessage(`Your appointment has been booked`);

    if (queue && createQueueDto.paymentMode === PaymentMode.RAZORPAY) {
      const payment = await this.queueService.createPayment(queue.id);

      return {
        ...queue,
        payment,
      };
    }
    return queue;
  }

  @Post('verify-payment')
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.PATIENT)
  verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto) {
    return this.queueService.verifyPayment(verifyPaymentDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  findAll(@Query('date') date?: string) {
    return this.queueService.findAll(date);
  }

  @Get('doctor/:doctorId/queue')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  getQueueForDoctor(
    @Param('doctorId') doctorId: string,
    @Query('id') queueId?: string,
  ) {
    const queue = this.queueService.getQueueForDoctor(doctorId, queueId);
    return queue;
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string) {
    const queue = await this.queueService.findOne(id);
    return queue;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  update(@Param('id') id: string, @Body() updateQueueDto: UpdateQueueDto) {
    return this.queueService.update(id, updateQueueDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.queueService.remove(id);
  }

  @Patch(':id/call')
  @Roles(Role.ADMIN, Role.DOCTOR)
  callQueue(@StandardParam() params: StandardParams, @Param('id') id: string) {
    params.setMessage(`Patient has been called`);
    return this.queueService.callQueue(id);
  }

  @Patch(':id/clock-in')
  @Roles(Role.ADMIN, Role.DOCTOR)
  clockIn(@StandardParam() params: StandardParams, @Param('id') id: string) {
    params.setMessage(`Appointment started`);
    return this.queueService.clockIn(id);
  }

  @Patch(':id/skip')
  @Roles(Role.ADMIN, Role.DOCTOR)
  skipQueue(@StandardParam() params: StandardParams, @Param('id') id: string) {
    params.setMessage(`Patient has been temporarily skipped`);
    return this.queueService.skipQueue(id);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.DOCTOR)
  completeAppointmentQueue(
    @StandardParam() params: StandardParams,
    @Param('id') id: string,
    @Body() completeQueueDto: CompleteQueueDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    params.setMessage(`Appointment Completed`);
    return this.queueService.completeAppointmentQueue(
      id,
      completeQueueDto,
      user,
    );
  }

  @Get('receipt/:id')
  async appointmentReceiptPdf(@Param('id') id: string, @Res() res: Response) {
    const { pdf, metaData } = await this.queueService.appointmentReceiptPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=${metaData.filename}`,
      'Content-Length': pdf.length,
      'Content-Title': metaData.title,
    });

    res.end(pdf);
  }
}
