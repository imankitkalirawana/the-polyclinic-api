/// <reference types="express" />

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      role: string;
      sessionId: string;
      type: 'tenant';
      tenantSlug: string;
    }

    interface Request {
      tenantSlug?: string;
    }
  }
}

export {};
