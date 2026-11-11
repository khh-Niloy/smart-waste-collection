import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/enums/role.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { seedAdmin } from '../src/scripts/seed-admin';
import { User, UserDocument } from '../src/users/schemas/user.schema';

interface HealthBody {
  status: string;
  database: string;
}

interface SafeUserBody {
  id: string;
  email: string;
  role: Role;
  passwordHash?: string;
  hashedRefreshToken?: string | null;
}

function extractCookieValue(
  setCookieHeader: string[] | string | undefined,
  name: string,
): string | null {
  if (!setCookieHeader) return null;
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  for (const header of headers) {
    const [pair] = header.split(';');
    const [key, ...valueParts] = pair.split('=');
    if (key.trim() === name) {
      return valueParts.join('=');
    }
  }
  return null;
}

describe('Phase 1 Foundation & Authentication (e2e)', () => {
  let mongod: MongoMemoryServer;
  let mongoUri: string;
  let app: INestApplication<App>;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_ACCESS_SECRET = 'e2e_access_secret_key';
    process.env.JWT_REFRESH_SECRET = 'e2e_refresh_secret_key';
    process.env.CLIENT_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableCors({
      origin: ['http://localhost:3000'],
      credentials: true,
    });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('1-3. confirms health, MongoDB connection, and all 4 schemas registered', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = res.body as HealthBody;
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');

    const modelNames = connection.modelNames();
    expect(modelNames).toEqual(
      expect.arrayContaining([
        'User',
        'WasteReport',
        'CollectionTeam',
        'ReportStatusHistory',
      ]),
    );
  });

  it('4-13. enforces full citizen auth, refresh rotation, logout revocation, and admin RBAC', async () => {
    const server = app.getHttpServer();
    const userModel = connection.model<UserDocument>(User.name);

    // Unauthorized access is rejected
    await request(server).get('/api/v1/auth/me').expect(401);
    await request(server).get('/api/v1/users').expect(401);

    // Mismatched password rejected
    await request(server)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Amina Rahman',
        email: 'amina@example.com',
        password: 'Password123',
        confirmPassword: 'WrongPassword',
      })
      .expect(400);

    // Register citizen (attempting role: ADMIN must be ignored/overridden to CITIZEN)
    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Amina Rahman',
        email: 'Amina@Example.com',
        phone: '+8801711000000',
        password: 'Password123',
        confirmPassword: 'Password123',
        role: Role.ADMIN,
      })
      .expect(201);

    const registeredUser = registerRes.body as SafeUserBody;
    expect(registeredUser.email).toBe('amina@example.com');
    expect(registeredUser.role).toBe(Role.CITIZEN);
    expect(registeredUser.passwordHash).toBeUndefined();
    expect(registeredUser.hashedRefreshToken).toBeUndefined();

    const regCookies = registerRes.headers['set-cookie'];
    expect(extractCookieValue(regCookies, 'Authentication')).toBeTruthy();
    expect(extractCookieValue(regCookies, 'Refresh')).toBeTruthy();

    // Duplicate email rejected
    await request(server)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Amina Duplicate',
        email: 'amina@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      })
      .expect(409);

    // Verify bcrypt passwordHash and hashedRefreshToken stored in MongoDB
    const dbCitizen = await userModel
      .findOne({ email: 'amina@example.com' })
      .exec();
    expect(dbCitizen).toBeTruthy();
    expect(dbCitizen!.passwordHash).not.toBe('Password123');
    expect(await bcrypt.compare('Password123', dbCitizen!.passwordHash)).toBe(
      true,
    );
    expect(dbCitizen!.hashedRefreshToken).toBeTruthy();

    // Invalid login rejected
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'amina@example.com', password: 'WrongPassword1' })
      .expect(401);

    // Valid login sets HTTP-only cookies
    const citizenAgent = request.agent(server);
    const loginRes = await citizenAgent
      .post('/api/v1/auth/login')
      .send({ email: 'amina@example.com', password: 'Password123' })
      .expect(200);

    const loggedInUser = loginRes.body as SafeUserBody;
    expect(loggedInUser.role).toBe(Role.CITIZEN);
    const firstRefreshToken = extractCookieValue(
      loginRes.headers['set-cookie'],
      'Refresh',
    );
    expect(firstRefreshToken).toBeTruthy();

    // Session verification via GET /api/v1/auth/me
    const meRes = await citizenAgent.get('/api/v1/auth/me').expect(200);
    const meBody = meRes.body as SafeUserBody;
    expect(meBody.email).toBe('amina@example.com');
    expect(meBody.passwordHash).toBeUndefined();
    expect(meBody.hashedRefreshToken).toBeUndefined();

    // Citizen cannot access admin-only route
    await citizenAgent.get('/api/v1/users').expect(403);

    // Token refresh rotates both cookies
    const refreshRes = await citizenAgent
      .post('/api/v1/auth/refresh')
      .expect(200);
    const rotatedRefreshToken = extractCookieValue(
      refreshRes.headers['set-cookie'],
      'Refresh',
    );
    expect(rotatedRefreshToken).toBeTruthy();

    // Reusing the pre-rotation refresh token is rejected if another token replaced it
    const secondLoginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'amina@example.com', password: 'Password123' })
      .expect(200);
    const newerRefreshToken = extractCookieValue(
      secondLoginRes.headers['set-cookie'],
      'Refresh',
    );
    expect(newerRefreshToken).toBeTruthy();

    // Logout clears DB hashedRefreshToken and clears cookies
    await citizenAgent.post('/api/v1/auth/logout').expect(200);
    const afterLogoutCitizen = await userModel
      .findOne({ email: 'amina@example.com' })
      .exec();
    expect(afterLogoutCitizen!.hashedRefreshToken).toBeNull();

    // Old refresh token is rejected after logout
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`Refresh=${firstRefreshToken}`])
      .expect(401);

    // Inactive user is rejected on login
    await userModel
      .updateOne({ email: 'amina@example.com' }, { $set: { isActive: false } })
      .exec();
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'amina@example.com', password: 'Password123' })
      .expect(401);
    await userModel
      .updateOne({ email: 'amina@example.com' }, { $set: { isActive: true } })
      .exec();

    // Admin seeding (idempotent) + admin login & RBAC verification
    const firstSeed = await seedAdmin({
      mongodbUri: mongoUri,
      adminName: 'Municipal Admin',
      adminEmail: 'admin@cleancity.local',
      adminPassword: 'AdminStrongPassword123',
    });
    expect(firstSeed.created).toBe(true);

    const secondSeed = await seedAdmin({
      mongodbUri: mongoUri,
      adminName: 'Municipal Admin',
      adminEmail: 'admin@cleancity.local',
      adminPassword: 'AdminStrongPassword123',
    });
    expect(secondSeed.created).toBe(false);

    const adminAgent = request.agent(server);
    const adminLoginRes = await adminAgent
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cleancity.local',
        password: 'AdminStrongPassword123',
      })
      .expect(200);
    const adminBody = adminLoginRes.body as SafeUserBody;
    expect(adminBody.role).toBe(Role.ADMIN);

    const usersListRes = await adminAgent.get('/api/v1/users').expect(200);
    const usersList = usersListRes.body as SafeUserBody[];
    expect(Array.isArray(usersList)).toBe(true);
    expect(usersList.length).toBe(2);
    for (const u of usersList) {
      expect(u.passwordHash).toBeUndefined();
      expect(u.hashedRefreshToken).toBeUndefined();
    }
  });
});
