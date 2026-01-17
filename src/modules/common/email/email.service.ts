import { Injectable } from '@nestjs/common';
import { resend } from 'src/lib/resend';

@Injectable()
export class EmailService {
  async sendEmail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      const isProduction = process.env.NODE_ENV === 'production';

      const { error, data } = await resend.emails.send({
        from: 'admin@thepolyclinic.app',
        to: isProduction
          ? [to, 'divinelydeveloper@gmail.com']
          : ['divinelydeveloper@gmail.com'],
        subject,
        html,
      });

      console.log('[Email]: Sending Email');

      if (error) {
        console.error(
          `Error sending email to ${to} with subject ${subject}`,
          error,
        );
      }

      return data;
    } catch (error) {
      console.error(
        `Error sending email to ${to} with subject ${subject}`,
        error,
      );
    }
  }
}
