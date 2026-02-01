import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { generatePassword } from '@/auth/users/users.utils';
import { SlackService } from '@/common/slack/slack.service';
import { formatDate } from 'date-fns';
import { InjectModel } from '@nestjs/mongoose';
import { MasterKey } from './schemas/masterkey.schema';
import { Model } from 'mongoose';

@Injectable()
export class MasterKeyService {
  constructor(
    @InjectModel(MasterKey.name)
    private masterKeyModel: Model<MasterKey>,
    private readonly slackService: SlackService,
  ) {}

  private readonly globalMasterKeyKey = 'global_master_key';
  private readonly globalMasterKeyDescription =
    'Global master key for the application to authenticate requests';

  private async generateRandomString(password: string) {
    return await bcrypt.hash(password, 10);
  }

  async getGlobalMasterKey() {
    const masterKey = await this.masterKeyModel.findOne({
      key: this.globalMasterKeyKey,
    });
    if (!masterKey) {
      throw new NotFoundException('Master key not found');
    }
    return masterKey;
  }

  private async createGlobalMasterKey(password: string) {
    await this.masterKeyModel.create({
      key: this.globalMasterKeyKey,
      value_digest: await this.generateRandomString(password),
      description: this.globalMasterKeyDescription,
    });
  }

  async rotateGlobalMasterKey() {
    const password = generatePassword();

    const result = await this.masterKeyModel.updateOne(
      { key: this.globalMasterKeyKey },
      { value_digest: await this.generateRandomString(password) },
    );

    if (result.modifiedCount === 0) {
      await this.createGlobalMasterKey(password);
    }
    await this.slackService.sendMessage(
      `Masterkey for ${formatDate(new Date(), 'dd-MM-yyyy')}: \`${password}\``,
    );
  }

  //   verify master key
  async verifyGlobalMasterKey(password: string) {
    const masterKey = await this.getGlobalMasterKey();

    return {
      isValid: await bcrypt.compare(password, masterKey.value_digest),
    };
  }
}
