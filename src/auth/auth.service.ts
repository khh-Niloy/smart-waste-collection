import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SafeUser, sanitizeUser } from '../users/utils/sanitize-user.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const existingUser = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    const createdUser = await this.userModel.create({
      fullName: registerDto.fullName.trim(),
      email: normalizedEmail,
      ...(registerDto.phone?.trim() ? { phone: registerDto.phone.trim() } : {}),
      passwordHash,
      role: Role.CITIZEN,
      isActive: true,
      hashedRefreshToken: null,
    });

    const tokens = await this.generateTokens(
      createdUser._id.toString(),
      createdUser.email,
      createdUser.role,
    );
    await this.updateRefreshToken(
      createdUser._id.toString(),
      tokens.refreshToken,
    );

    return {
      user: sanitizeUser(createdUser),
      tokens,
    };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: sanitizeUser(user),
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { hashedRefreshToken: null } })
      .exec();
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.hashedRefreshToken || !user.isActive) {
      throw new UnauthorizedException('Access Denied');
    }

    const rtMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!rtMatches) {
      throw new UnauthorizedException('Access Denied');
    }

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );
    await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);
    return tokens;
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User does not exist or is inactive');
    }
    return sanitizeUser(user);
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<AuthTokens> {
    const accessSecret =
      this.configService.get<string>('jwt.accessSecret') ||
      'dev_access_secret_change_me';
    const accessExpiresIn = (this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) || '15m') as JwtExpiresIn;

    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      'dev_refresh_secret_change_me';
    const refreshExpiresIn = (this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) || '7d') as JwtExpiresIn;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: accessSecret,
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { hashedRefreshToken: hash } })
      .exec();
  }
}
