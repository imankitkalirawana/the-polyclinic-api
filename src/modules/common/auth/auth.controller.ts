import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { BearerAuthGuard } from './guards/bearer-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from './decorators/current-user.decorator';
import { StandardParams, StandardParam } from 'nest-standard-response';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  async requestOtp(
    @StandardParam() params: StandardParams,
    @Body() requestOtpDto: RequestOtpDto,
  ) {
    await this.authService.requestOtp(requestOtpDto);
    params.setMessage('OTP sent to your email');
    return null;
  }

  @Post('otp/verify')
  async verifyOtp(
    @StandardParam() params: StandardParams,
    @Body() verifyOtpDto: VerifyOtpDto,
  ) {
    await this.authService.verifyOtp(verifyOtpDto);
    params.setMessage('OTP verified successfully');
    return null;
  }

  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  async checkEmail(@Body() checkEmailDto: CheckEmailDto) {
    return this.authService.checkEmail(checkEmailDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  async forgotPassword(
    @StandardParam() params: StandardParams,
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ) {
    await this.authService.forgotPassword(forgotPasswordDto);
    params.setMessage('Password updated successfully');
    return null;
  }

  @Get('session')
  @UseGuards(BearerAuthGuard)
  async getSession(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getSession(user.userId);
  }

  @Delete('logout')
  @UseGuards(BearerAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: CurrentUserPayload) {
    await this.authService.logout(user.sessionId);
  }
}
