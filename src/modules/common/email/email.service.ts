// qr.service.ts
import { Injectable } from '@nestjs/common';
import { resend } from 'src/lib/resend';
import { Logger } from '@nestjs/common';
import receiptTemplate from './templates/receipt';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  async sendEmail(to: string, subject: string) {
    this.logger.log(`Sending email to ${to} with subject ${subject}`);
    try {
      const response = await resend.emails.send({
        from: 'admin@thepolyclinic.app',
        to: [to],
        subject,
        html: receiptTemplate(),
      });
      this.logger.log(
        `Email sent successfully to ${to} with subject ${subject}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Error sending email to ${to} with subject ${subject}`,
        error,
      );
      throw error;
    }
  }
}
