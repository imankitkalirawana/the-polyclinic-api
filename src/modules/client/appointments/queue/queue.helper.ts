import { Queue } from './entities/queue.entity';

interface FormattedQueue extends Queue {
  nextQueueId?: string;
  previousQueueId?: string;
}

export function formatQueue(queue: FormattedQueue) {
  return {
    id: queue.id,
    status: queue.status,
    sequenceNumber: queue.sequenceNumber,
    notes: queue.notes,
    title: queue.title,
    prescription: queue.prescription,
    startedAt: queue.startedAt,
    completedAt: queue.completedAt,
    completedBy: queue.completedBy,
    completedByUser: queue.completedByUser
      ? {
          id: queue.completedByUser.id,
          email: queue.completedByUser.email,
          name: queue.completedByUser.name,
        }
      : null,
    createdAt: queue.createdAt,
    updatedAt: queue.updatedAt,
    nextQueueId: queue.nextQueueId,
    previousQueueId: queue.previousQueueId,

    patient: queue.patient
      ? {
          id: queue.patient.id,
          gender: queue.patient.gender,
          age: queue.patient.age,
          email: queue.patient.user?.email ?? null,
          name: queue.patient.user?.name ?? null,
          phone: queue.patient.user?.phone ?? null,
          userId: queue.patient.user?.id ?? null,
          image: queue.patient.user?.image ?? null,
        }
      : null,

    doctor: queue.doctor
      ? {
          id: queue.doctor.id,
          specialization: queue.doctor.specialization,
          email: queue.doctor.user?.email ?? null,
          name: queue.doctor.user?.name ?? null,
          userId: queue.doctor.user?.id ?? null,
          image: queue.doctor.user?.image ?? null,
        }
      : null,

    bookedByUser: queue.bookedByUser
      ? {
          id: queue.bookedByUser.id,
          email: queue.bookedByUser.email,
          name: queue.bookedByUser.name,
          phone: queue.bookedByUser.phone ?? null,
          image: queue.bookedByUser.image ?? null,
        }
      : null,
  };
}

export function appointmentConfirmationTemplate(queue: Queue) {
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
      <div class="value">${queue.id}</div>
    </div>
  </div>
  <footer>
    <p>The Polyclinic</p>
  </footer>
</body>
</html>
`;
}
