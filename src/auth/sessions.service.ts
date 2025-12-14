import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from 'generated/prisma/client';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: number,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Find a session by sessionId
   */
  async findSessionById(sessionId: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: {
        sessionId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  /**
   * Find all active sessions for a user
   */
  async findSessionsByUserId(userId: number): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(), // Only active sessions
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Validate a session (check if it exists and is not expired)
   */
  async validateSession(sessionId: string): Promise<Session> {
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (new Date() > session.expiresAt) {
      // Session expired, delete it
      await this.deleteSession(sessionId);
      throw new UnauthorizedException('Session has expired');
    }

    return session;
  }

  /**
   * Delete a session by sessionId
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: {
        sessionId,
      },
    });
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId: number): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
      },
    });
  }

  /**
   * Delete expired sessions (cleanup task)
   */
  async deleteExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  /**
   * Update session expiration time
   */
  async refreshSession(
    sessionId: string,
    newExpiresAt: Date,
  ): Promise<Session> {
    return this.prisma.session.update({
      where: {
        sessionId,
      },
      data: {
        expiresAt: newExpiresAt,
      },
    });
  }
}
