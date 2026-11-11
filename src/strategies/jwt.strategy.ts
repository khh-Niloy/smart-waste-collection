import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SafeUser, sanitizeUser } from '../users/utils/sanitize-user.util';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const cookies = request?.cookies as
            Record<string, string | undefined> | undefined;
          return cookies?.['Authentication'] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.accessSecret') ||
        'dev_access_secret_change_me',
    });
  }

  async validate(payload: JwtAccessPayload): Promise<SafeUser> {
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('User does not exist');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return sanitizeUser(user);
  }
}
