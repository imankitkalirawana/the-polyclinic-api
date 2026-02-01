import { Controller, Get, Post } from '@nestjs/common';
import { MasterKeyService } from './masterkey.service';
import { StandardParam, StandardParams } from 'nest-standard-response';

@Controller('utilities/master-key')
export class MasterKeyController {
  constructor(private readonly masterKeyService: MasterKeyService) {}

  @Get('global')
  async getGlobalMasterKey() {
    return this.masterKeyService.getGlobalMasterKey();
  }

  @Post('global')
  async createGlobalMasterKey(@StandardParam() params: StandardParams) {
    const result = await this.masterKeyService.generateGlobalMasterKey();
    params.setMessage('Global master key generated successfully');
    return result;
  }
}
