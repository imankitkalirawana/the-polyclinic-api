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

@Controller('client/appointments/queue')
@UseGuards(BearerAuthGuard, RolesGuard, FieldRestrictionsGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  create(
    @Body() createQueueDto: CreateQueueDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.queueService.create(createQueueDto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  findAll(@Query('date') date?: string) {
    return this.queueService.findAll(date);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST)
  findOne(@Param('id') id: string) {
    return this.queueService.findOne(id);
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
}
