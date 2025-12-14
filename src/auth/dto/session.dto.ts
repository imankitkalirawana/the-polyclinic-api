import { Role } from 'generated/prisma/client';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  image?: string | null;
  organizationId?: string | null;
  phone?: string | null;
}

export interface SessionResponse {
  user?: SessionUser | null;
}
