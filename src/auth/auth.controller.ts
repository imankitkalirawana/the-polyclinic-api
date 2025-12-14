import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'generated/prisma/client';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    const userExists = await this.usersService.userExistsByEmail(
      sendOtpDto.email,
    );
    if (!userExists) {
      throw new NotFoundException('User with this email does not exist');
    }
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      req.socket.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new NotFoundException('Token not found');
    }

    const token = authHeader.substring(7);

    // Decode token to get sessionId
    const payload = await this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    });

    if (!payload.sessionId) {
      throw new NotFoundException('Session ID not found in token');
    }

    return this.authService.logout(payload.sessionId);
  }

  @Get('session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getCurrentSession(@CurrentUser() currentUser: User) {
    return this.authService.getCurrentSession(currentUser);
  }
}
