import { Injectable, Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import { resend } from 'src/libs/resend';
import AppleReceiptEmail from '../../../../emails/receipt';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(to: string, subject: string) {
    this.logger.log(`Sending email to ${to} with subject ${subject}`);
    try {
      const html = await render(AppleReceiptEmail());
      const response = await resend.emails.send({
        from: 'admin@thepolyclinic.app',
        to: [to],
        subject,
        html,
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
