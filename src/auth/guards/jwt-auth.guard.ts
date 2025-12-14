import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SessionsService } from '../sessions.service';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private sessionsService: SessionsService,
    private jwtService: JwtService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // First, run the parent guard to validate JWT token
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    // Decode token to get userId and sessionId
    const payload = await this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET || 'your-secret-key',
    });

    // Validate the specific session if sessionId is present in the token
    if (payload.sessionId) {
      try {
        const session = await this.sessionsService.validateSession(
          payload.sessionId,
        );

        // Verify the session belongs to the user in the token
        if (session.userId !== payload.userId) {
          throw new UnauthorizedException('Session does not match user');
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new UnauthorizedException('Invalid session');
      }
    } else {
      // Fallback: check if user has at least one active session
      const userSessions = await this.sessionsService.findSessionsByUserId(
        payload.userId,
      );

      if (userSessions.length === 0) {
        throw new UnauthorizedException('No active session found');
      }
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
