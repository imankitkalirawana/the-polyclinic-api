/// <reference types="express" />

import { Role } from '../common/enums/role.enum';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      name: string;
      phone: string | null;
      role: Role;
      sessionId: string;
      type: 'tenant';
      tenantSlug: string;
      patientId?: string | null;
      doctorId?: string | null;
    }

    interface Request {
      tenantSlug?: string;
    }
  }
}

export {};
