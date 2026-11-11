import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ReportPriority } from '../src/common/enums/report-priority.enum';
import { ReportStatus } from '../src/common/enums/report-status.enum';
import { WasteCategory } from '../src/common/enums/waste-category.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { seedAdmin } from '../src/scripts/seed-admin';
import { SupabaseStorageService } from '../src/storage/supabase-storage.service';

interface ReportBody {
  _id: string;
  reportCode: string;
  category: WasteCategory;
  priority: ReportPriority;
  status: ReportStatus;
  photoUrl?: string | null;
  photoPreviewUrl?: string | null;
  statusHistory?: Array<{ newStatus: ReportStatus }>;
  priorityHistory?: Array<{ newPriority: ReportPriority; reason: string }>;
}

interface PaginatedBody<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

describe('Phases 2-4 Citizen Reporting, Admin Operations, Uploads, Stats & Maps (e2e)', () => {
  let mongod: MongoMemoryServer;
  let mongoUri: string;
  let app: INestApplication<App>;

  const mockStorage = {
    isConfigured: jest.fn().mockReturnValue(true),
    uploadFile: jest.fn().mockResolvedValue(undefined),
    createSignedPreviewUrl: jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(`https://supabase.test/storage/v1/object/sign/${key}`),
      ),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_ACCESS_SECRET = 'e2e_workflow_access_secret';
    process.env.JWT_REFRESH_SECRET = 'e2e_workflow_refresh_secret';
    process.env.CLIENT_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseStorageService)
      .useValue(mockStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    await seedAdmin({
      mongodbUri: mongoUri,
      adminName: 'Municipal Admin',
      adminEmail: 'admin@cleancity.local',
      adminPassword: 'AdminStrongPassword123',
    });
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('executes complete citizen -> upload -> triage -> team -> status -> stats -> map workflow', async () => {
    const server = app.getHttpServer();

    const citizen1 = request.agent(server);
    const citizen2 = request.agent(server);
    const admin = request.agent(server);

    await citizen1
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Citizen One',
        email: 'citizen1@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      })
      .expect(201);

    await citizen2
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Citizen Two',
        email: 'citizen2@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      })
      .expect(201);

    await admin
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@cleancity.local',
        password: 'AdminStrongPassword123',
      })
      .expect(200);

    // Reject invalid report submissions
    await citizen1
      .post('/api/v1/reports')
      .send({ description: 'Too short', address: '' })
      .expect(400);

    // Reject invalid file upload (spoofed exe)
    await citizen1
      .post('/api/v1/uploads/photo')
      .attach('file', Buffer.from('MZ\x90\x00evil'), {
        filename: 'evil.png',
        contentType: 'image/png',
      })
      .expect(400);

    // Upload valid PNG photo via multipart/form-data
    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const uploadRes = await citizen1
      .post('/api/v1/uploads/photo')
      .attach('file', validPng, {
        filename: 'site-photo.png',
        contentType: 'image/png',
      })
      .expect(201);

    const { storageKey } = uploadRes.body as { storageKey: string };
    expect(storageKey).toMatch(/^reports\/[a-f0-9-]+\.png$/);

    // Submit report near a school with coordinates + uploaded photo key
    const createRes = await citizen1
      .post('/api/v1/reports')
      .send({
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Large overflowing garbage bin blocking footpath near primary school gate.',
        address: 'Road 7, Dhanmondi, Dhaka, Ward 15',
        street: 'Road 7',
        area: 'Dhanmondi',
        city: 'Dhaka',
        ward: 'Ward 15',
        latitude: 23.7465,
        longitude: 90.376,
        photoUrl: storageKey,
      })
      .expect(201);

    const createdReport = createRes.body as ReportBody;
    expect(createdReport.reportCode).toMatch(/^CC-\d{8}-[A-F0-9]{6}$/);
    expect(createdReport.priority).toBe(ReportPriority.HIGH);
    expect(createdReport.status).toBe(ReportStatus.SUBMITTED);
    expect(createdReport.photoPreviewUrl).toContain(storageKey);

    // Prevent rapid duplicate submission
    await citizen1
      .post('/api/v1/reports')
      .send({
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Large overflowing garbage bin blocking footpath near primary school gate.',
        address: 'Road 7, Dhanmondi, Dhaka, Ward 15',
      })
      .expect(409);

    // Submit a second address-only report (no coordinates)
    const noCoordsRes = await citizen1
      .post('/api/v1/reports')
      .send({
        category: WasteCategory.MISSED_WASTE_COLLECTION,
        description:
          'Morning collection truck missed the side alley residential bins.',
        address: 'Lane 2, Banani, Dhaka',
      })
      .expect(201);
    const noCoordsReport = noCoordsRes.body as ReportBody;

    // Citizen 1 summary & listing
    const summaryRes = await citizen1
      .get('/api/v1/reports/my-summary')
      .expect(200);
    expect((summaryRes.body as { total: number }).total).toBe(2);

    const myRes = await citizen1
      .get(`/api/v1/reports/my?search=${createdReport.reportCode}`)
      .expect(200);
    expect((myRes.body as PaginatedBody<ReportBody>).items.length).toBe(1);

    // Ownership & RBAC protections
    await citizen2.get(`/api/v1/reports/${createdReport._id}`).expect(403);
    await citizen1.get('/api/v1/reports/invalid-id').expect(400);
    await citizen1.get('/api/v1/reports').expect(403);
    await citizen1.get('/api/v1/teams').expect(403);
    await citizen1.get('/api/v1/statistics/overview').expect(403);
    await citizen1.get('/api/v1/maps/reports').expect(403);

    // Admin creates active & inactive teams
    const activeTeamRes = await admin
      .post('/api/v1/teams')
      .send({
        teamName: 'Zone A Rapid Unit',
        contactPerson: 'Tariq Mahmud',
        phone: '+8801711001122',
        serviceArea: 'Dhanmondi',
      })
      .expect(201);
    const activeTeamId = (activeTeamRes.body as { _id: string })._id;

    const inactiveTeamRes = await admin
      .post('/api/v1/teams')
      .send({
        teamName: 'Retired Crew',
        contactPerson: 'Old Lead',
        phone: '+8801711000000',
        serviceArea: 'Mirpur',
      })
      .expect(201);
    const inactiveTeamId = (inactiveTeamRes.body as { _id: string })._id;

    await admin
      .patch(`/api/v1/teams/${inactiveTeamId}/status`)
      .send({ isActive: false })
      .expect(200);

    // Reject assignment to inactive team
    await admin
      .patch(`/api/v1/reports/${createdReport._id}/assign-team`)
      .send({ teamId: inactiveTeamId })
      .expect(400);

    // Assign active team -> status advances to ASSIGNED
    const assignedRes = await admin
      .patch(`/api/v1/reports/${createdReport._id}/assign-team`)
      .send({ teamId: activeTeamId })
      .expect(200);
    expect((assignedRes.body as ReportBody).status).toBe(ReportStatus.ASSIGNED);

    // Invalid status transition (ASSIGNED -> RESOLVED directly) rejected
    await admin
      .patch(`/api/v1/reports/${createdReport._id}/status`)
      .send({ status: ReportStatus.RESOLVED })
      .expect(400);

    // Rejection without reason rejected
    await admin
      .patch(`/api/v1/reports/${noCoordsReport._id}/status`)
      .send({ status: ReportStatus.REJECTED, note: '   ' })
      .expect(400);

    // Valid status progression: ASSIGNED -> IN_PROGRESS -> RESOLVED
    await admin
      .patch(`/api/v1/reports/${createdReport._id}/status`)
      .send({ status: ReportStatus.IN_PROGRESS, note: 'Crew arrived on site' })
      .expect(200);

    const resolvedRes = await admin
      .patch(`/api/v1/reports/${createdReport._id}/status`)
      .send({ status: ReportStatus.RESOLVED, note: 'Area cleared and swept' })
      .expect(200);

    const resolvedReport = resolvedRes.body as ReportBody;
    expect(resolvedReport.status).toBe(ReportStatus.RESOLVED);
    expect(resolvedReport.statusHistory?.length).toBe(4);

    // Admin priority override with reason
    const overrideRes = await admin
      .patch(`/api/v1/reports/${createdReport._id}/priority`)
      .send({
        priority: ReportPriority.URGENT,
        reason: 'Escalated after inspection confirmed school entrance blocked.',
      })
      .expect(200);
    expect((overrideRes.body as ReportBody).priority).toBe(
      ReportPriority.URGENT,
    );
    expect((overrideRes.body as ReportBody).priorityHistory?.length).toBe(1);

    // Statistics aggregation reflects exact counts
    const statsRes = await admin.get('/api/v1/statistics/overview').expect(200);
    const stats = statsRes.body as {
      summary: {
        totalReports: number;
        resolvedReports: number;
        activeTeamsCount: number;
      };
    };
    expect(stats.summary.totalReports).toBe(2);
    expect(stats.summary.resolvedReports).toBe(1);
    expect(stats.summary.activeTeamsCount).toBe(1);

    // Map markers only include reports with coordinates and expose no citizen PII
    const mapRes = await admin.get('/api/v1/maps/reports').expect(200);
    const markers = mapRes.body as Array<Record<string, unknown>>;
    expect(markers.length).toBe(1);
    expect(markers[0].reportCode).toBe(createdReport.reportCode);
    expect(markers[0].citizenId).toBeUndefined();
    expect(markers[0].email).toBeUndefined();
  });
});
