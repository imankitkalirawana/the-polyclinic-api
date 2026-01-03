// qr.service.ts
import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  async generateBase64(data: string): Promise<string> {
    return QRCode.toDataURL(data);
  }

  async generateBuffer(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data);
  }
}
