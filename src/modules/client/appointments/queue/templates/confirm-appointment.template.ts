import { formatDate } from 'date-fns';
import { Queue } from '../entities/queue.entity';

export function appointmentConfirmationTemplate(queue: Queue, qrCode: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Appointment Booked</title>
    <style>
      * {
        box-sizing: border-box;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Helvetica, Arial, sans-serif;
      }
  
      body {
        background: #f5f6f8;
        margin: 0;
      }
  
      .card {
        width: 100%;
        margin: auto;
        padding: 28px;
      }
  
      .icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #c8eed6;
        color: #3baa6f;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        margin: 0 auto;
      }
  
      h1 {
        text-align: center;
        font-size: 20px;
        margin: 16px 0 6px;
        color: #111827;
      }
  
      .subtitle {
        text-align: center;
        font-size: 13px;
        color: #6b7280;
        margin-bottom: 24px;
      }
  
      .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 16px 0 24px;
      }
  
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 22px;
      }
  
      .label {
        font-size: 13px;
        color: #6b7280;
      }
  
      .value {
        font-size: 15px;
        font-weight: 600;
        color: #111827;
      }
  
      footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
      margin-top: 24px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✓</div>
  
      <h1>Appointment Booked</h1>
      <div class="subtitle">
        We sent a confirmation email to the patient and the doctor.
      </div>
  
      <div class="divider"></div>
  
      <div class="row">
        <div class="label">Token Number</div>
        <div class="value">${queue.sequenceNumber}</div>
      </div>
  
      <div class="row">
        <div class="label">Patient Name</div>
        <div class="value">${queue.patient.user?.name}</div>
      </div>
  
      <div class="row">
        <div class="label">Doctor Name</div>
        <div class="value">${queue.doctor.user?.name}</div>
      </div>
  
      <div class="row">
        <div class="label">Reference Number</div>
        <div class="value">${queue.referenceNumber}</div>
      </div>

      <div class="row">
        <div class="label">Payment Mode</div>
        <div class="value">${queue.paymentMode}</div>
      </div>

      <div class="row">
        <div class="label">Booked On</div>
        <div class="value">${formatDate(queue.createdAt, 'dd MMM yyyy hh:mm a')}</div>
      </div>
      <div class="row">
        <div class="label"></div>
        <div class="value">
         <img src="${qrCode}" alt="QR Code" style="width: 50px; height: 50px;" />
        </div>
      </div>
    </div>
    <footer>
      <p>The Polyclinic</p>
    </footer>
  </body>
  </html>
  `;
}
