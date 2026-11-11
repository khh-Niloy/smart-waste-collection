import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { SafeUser } from '../users/utils/sanitize-user.util';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new citizen account' })
  @ApiResponse({ status: 201, description: 'Citizen registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, tokens } = await this.authService.register(registerDto);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and set HTTP-only auth cookies' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, tokens } = await this.authService.login(loginDto);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    res.clearCookie('Authentication', this.cookieOptions);
    res.clearCookie('Refresh', this.cookieOptions);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate access and refresh tokens using Refresh cookie',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const tokens = await this.authService.refreshTokens(
      user.id,
      user.refreshToken || '',
    );
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Tokens refreshed' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Authenticated user returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.authService.getMe(user.id);
  }

  private setCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie('Authentication', accessToken, {
      ...this.cookieOptions,
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('Refresh', refreshToken, {
      ...this.cookieOptions,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private get cookieOptions(): CookieOptions {
    const isProd = this.configService.get<string>('nodeEnv') === 'production';
    const sameSite =
      this.configService.get<'lax' | 'strict' | 'none'>('cookie.sameSite') ||
      (isProd ? 'none' : 'lax');
    const secure = this.configService.get<boolean>('cookie.secure') ?? isProd;

    return {
      path: '/',
      sameSite,
      secure,
    };
  }
}
