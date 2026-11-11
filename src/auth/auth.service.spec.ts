import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      create: jest.fn(),
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                'jwt.accessSecret': 'test-access-secret',
                'jwt.accessExpiresIn': '15m',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '7d',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('rejects registration when passwords do not match', async () => {
    await expect(
      service.register({
        fullName: 'Test Citizen',
        email: 'citizen@example.com',
        password: 'Password123',
        confirmPassword: 'DifferentPassword',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate email registration', async () => {
    userModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'existing-id' }),
    });

    await expect(
      service.register({
        fullName: 'Test Citizen',
        email: 'Citizen@Example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('registers citizen with hashed password and sanitized output', async () => {
    userModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const createdDoc = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      fullName: 'Test Citizen',
      email: 'citizen@example.com',
      phone: '+8801711000000',
      passwordHash: 'hashed',
      hashedRefreshToken: null,
      role: Role.CITIZEN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userModel.create.mockResolvedValue(createdDoc);

    const result = await service.register({
      fullName: 'Test Citizen',
      email: 'Citizen@Example.com',
      phone: '+8801711000000',
      password: 'Password123',
      confirmPassword: 'Password123',
    });

    expect(result.user.role).toBe(Role.CITIZEN);
    expect(result.user.email).toBe('citizen@example.com');
    expect(
      (result.user as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
    expect(
      (result.user as unknown as Record<string, unknown>).hashedRefreshToken,
    ).toBeUndefined();
    expect(result.tokens.accessToken).toBe('access-token-123');
    expect(result.tokens.refreshToken).toBe('refresh-token-456');
  });

  it('rejects login for inactive accounts', async () => {
    const hash = await bcrypt.hash('Password123', 4);
    userModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'citizen@example.com',
        passwordHash: hash,
        isActive: false,
        role: Role.CITIZEN,
      }),
    });

    await expect(
      service.login({
        email: 'citizen@example.com',
        password: 'Password123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
