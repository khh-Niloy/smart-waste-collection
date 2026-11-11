import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import { SafeUser } from '../users/utils/sanitize-user.util';
import { AuthService } from './auth.service';
import { DemoLoginDto } from './dto/demo-login.dto';
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, tokens } = await this.authService.register(registerDto);
    this.setCookies(res, req, tokens.accessToken, tokens.refreshToken);
    return user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and set HTTP-only auth cookies' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, tokens } = await this.authService.login(loginDto);
    this.setCookies(res, req, tokens.accessToken, tokens.refreshToken);
    return user;
  }

  @Post('demo-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quick sign-in for demo Citizen or Admin account' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Account unavailable' })
  async demoLogin(
    @Body() demoLoginDto: DemoLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const { user, tokens } = await this.authService.demoLogin(
      demoLoginDto.role,
    );
    this.setCookies(res, req, tokens.accessToken, tokens.refreshToken);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    const options = this.getCookieOptions(req);
    res.clearCookie('Authentication', options);
    res.clearCookie('Refresh', options);
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const tokens = await this.authService.refreshTokens(
      user.id,
      user.refreshToken || '',
    );
    this.setCookies(res, req, tokens.accessToken, tokens.refreshToken);
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
    req: Request,
    accessToken: string,
    refreshToken: string,
  ): void {
    const options = this.getCookieOptions(req);
    res.cookie('Authentication', accessToken, {
      ...options,
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('Refresh', refreshToken, {
      ...options,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private getCookieOptions(req?: Request): CookieOptions {
    const isProd = this.configService.get<string>('nodeEnv') === 'production';
    const forwardedProto = req?.headers['x-forwarded-proto'];
    const isHttps =
      Boolean(req?.secure) ||
      forwardedProto === 'https' ||
      process.env.VERCEL === '1' ||
      isProd;

    const origin = req?.headers.origin;
    const host = req?.headers.host;
    let isCrossSite = false;
    if (origin && host) {
      try {
        isCrossSite = new URL(origin).host !== host;
      } catch {
        isCrossSite = false;
      }
    }

    // Cross-site HTTPS deployments (e.g. separate Vercel frontend & API)
    // require SameSite=None and Secure=true for browsers to send cookies.
    if (isHttps && (isCrossSite || process.env.VERCEL === '1' || isProd)) {
      return {
        path: '/',
        sameSite: 'none',
        secure: true,
      };
    }

    const sameSite =
      this.configService.get<'lax' | 'strict' | 'none'>('cookie.sameSite') ||
      'lax';
    const secure = this.configService.get<boolean>('cookie.secure') ?? false;

    return {
      path: '/',
      sameSite: sameSite === 'none' && !isHttps ? 'lax' : sameSite,
      secure: isHttps ? secure : false,
    };
  }
}
