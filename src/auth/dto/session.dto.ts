import { Role } from 'generated/prisma/client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  image: string;
  organization: string | null;
  phone: string;
}

export interface SessionResponse {
  user?: SessionUser | null;
}
