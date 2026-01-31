import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StandardParam, StandardParams } from 'nest-standard-response';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { BearerAuthGuard } from './guards/bearer-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('check-email')
  async checkEmail(@Body() { email }: { email: string }) {
    return await this.authService.checkEmail(email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  @Post('register')
  async register(
    @StandardParam() params: StandardParams,
    @Body() dto: RegisterDto,
  ) {
    const result = await this.authService.register(dto);
    params.setMessage('User registered successfully');
    return result;
  }

  @Get('session')
  @UseGuards(BearerAuthGuard)
  async session() {
    return await this.authService.getSession();
  }

  @Delete('logout')
  @UseGuards(BearerAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout() {
    await this.authService.logout();
    return null;
  }
}
