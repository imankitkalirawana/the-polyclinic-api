import { Injectable } from '@nestjs/common';
import puppeteer, { PaperFormat, type Browser } from 'puppeteer';

@Injectable()
export class PdfService {
  async htmlToPdf(html: string, format: PaperFormat = 'A4'): Promise<Buffer> {
    const browser: Browser = await puppeteer.launch({
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format,
      printBackground: true,
    });

    await browser.close();
    return Buffer.from(pdf);
  }
}
