import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SafeUser, sanitizeUser } from '../users/utils/sanitize-user.util';

export interface JwtRefreshPayload {
  sub: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const cookies = request?.cookies as
            Record<string, string | undefined> | undefined;
          return cookies?.['Refresh'] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.refreshSecret') ||
        'dev_refresh_secret_change_me',
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    payload: JwtRefreshPayload,
  ): Promise<SafeUser & { refreshToken: string }> {
    const cookies = request?.cookies as
      Record<string, string | undefined> | undefined;
    const refreshToken = cookies?.['Refresh'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('User does not exist');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return {
      ...sanitizeUser(user),
      refreshToken,
    };
  }
}
