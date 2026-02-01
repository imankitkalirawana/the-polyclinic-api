import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendMessage(text: string) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      this.logger.warn('Slack webhook URL not configured');
      return;
    }

    await firstValueFrom(
      this.httpService.post(webhookUrl, {
        text,
      }),
    );
  }
}
