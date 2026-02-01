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
  Req,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { BearerAuthGuard } from '@/auth/guards/bearer-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { FieldRestrictionsGuard } from '@/auth/guards/field-restrictions.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@/auth/decorators/current-user.decorator';
import { CompleteQueueDto } from './dto/compelete-queue.dto';
import { VerifyPaymentDto } from '@/client/payments/dto/verify-payment.dto';
import { Request, Response } from 'express';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { PaymentMode } from './enums/queue.enum';
import { formatQueue } from './queue.helper';

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
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  async findAll(@Req() req: Request, @Query('date') date?: string) {
    const queues = await this.queueService.findAll(date);
    return queues.map((queue) => formatQueue(queue, req.user.role));
  }

  @Get('aid/:aid')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  findByAid(@Param('aid') aid: string) {
    return this.queueService.findByAid(aid);
  }

  @Get('doctor/:doctorId/queue')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  getQueueForDoctor(
    @Param('doctorId') doctorId: string,
    @Query('id') queueId?: string,
    @Query('date') date?: string,
  ) {
    const queue = this.queueService.getQueueForDoctor({
      doctorId,
      queueId,
      appointmentDate: date ? new Date(date) : new Date(),
    });
    return queue;
  }

  @Get('patient/me')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  getQueueForPatient() {
    return this.queueService.getQueueForPatient();
  }

  @Get(':aid')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST, Role.PATIENT)
  getAppointmentByAid(@Param('aid') aid: string) {
    return this.queueService.getAppointmentByAid(aid);
  }

  @Get(':id/activity-logs')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async getActivityLogs(@Param('id') id: string) {
    return this.queueService.getActivityLogs(id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  async findOne(@Param('id') id: string) {
    const queue = await this.queueService.findOne(id);
    return formatQueue(queue);
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
