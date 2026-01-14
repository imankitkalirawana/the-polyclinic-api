import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(
    @Body() sendEmailDto: { to: string; subject: string; text: string },
  ) {
    return await this.emailService.sendEmail(
      sendEmailDto.to,
      sendEmailDto.subject,
    );
  }
}
