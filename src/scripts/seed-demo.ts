import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import mongoose, { Model, Types } from 'mongoose';
import { ReportPriority } from '../common/enums/report-priority.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
import { WasteCategory } from '../common/enums/waste-category.enum';
import {
  ReportStatusHistory,
  ReportStatusHistorySchema,
} from '../reports/schemas/report-status-history.schema';
import {
  WasteReport,
  WasteReportSchema,
} from '../reports/schemas/waste-report.schema';
import {
  CollectionTeam,
  CollectionTeamSchema,
} from '../teams/schemas/collection-team.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { seedAdmin } from './seed-admin';

async function seedDemoData(): Promise<void> {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }

  const mongodbUri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cleancity';

  // Ensure admin exists first
  await seedAdmin({ mongodbUri });

  const conn = await mongoose.createConnection(mongodbUri).asPromise();

  try {
    const UserModel: Model<User> = conn.model<User>(User.name, UserSchema);
    const TeamModel: Model<CollectionTeam> = conn.model<CollectionTeam>(
      CollectionTeam.name,
      CollectionTeamSchema,
    );
    const ReportModel: Model<WasteReport> = conn.model<WasteReport>(
      WasteReport.name,
      WasteReportSchema,
    );
    const HistoryModel: Model<ReportStatusHistory> =
      conn.model<ReportStatusHistory>(
        ReportStatusHistory.name,
        ReportStatusHistorySchema,
      );

    const admin = await UserModel.findOne({ role: Role.ADMIN }).exec();
    if (!admin) {
      throw new Error('Admin user could not be resolved');
    }

    const citizenPasswordHash = await bcrypt.hash('CitizenPass123!', 10);
    let citizen = await UserModel.findOne({
      email: 'citizen.demo@cleancity.local',
    }).exec();

    if (!citizen) {
      citizen = await UserModel.create({
        fullName: 'Nadia Karim',
        email: 'citizen.demo@cleancity.local',
        phone: '+8801711554433',
        passwordHash: citizenPasswordHash,
        role: Role.CITIZEN,
        isActive: true,
        hashedRefreshToken: null,
      });
    }

    const demoTeams = [
      {
        teamName: 'Zone A Rapid Sanitation Unit',
        contactPerson: 'Tariq Mahmud',
        phone: '+8801711001122',
        serviceArea: 'Dhanmondi & Ward 15',
        isActive: true,
      },
      {
        teamName: 'Zone B Hazmat & Spill Response',
        contactPerson: 'Farhana Akter',
        phone: '+8801812002233',
        serviceArea: 'Tejgaon & Karwan Bazar',
        isActive: true,
      },
      {
        teamName: 'Zone C Night Sweeper Crew',
        contactPerson: 'Rafiqul Islam',
        phone: '+8801913003344',
        serviceArea: 'Gulshan & Banani',
        isActive: true,
      },
    ];

    const teamMap = new Map<string, Types.ObjectId>();
    for (const t of demoTeams) {
      let existingTeam = await TeamModel.findOne({
        teamName: t.teamName,
      }).exec();
      if (!existingTeam) {
        existingTeam = await TeamModel.create(t);
      }
      teamMap.set(t.teamName, existingTeam._id);
    }

    const existingDemoCount = await ReportModel.countDocuments({
      reportCode: { $regex: /^CC-DEMO-/ },
    }).exec();

    if (existingDemoCount > 0) {
      console.log(
        `[seed:demo] Demo reports already seeded (${existingDemoCount} records). Skipping.`,
      );
      return;
    }

    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 86_400_000);

    const demoReports = [
      {
        reportCode: 'CC-DEMO-1001',
        citizenId: citizen._id,
        category: WasteCategory.HAZARDOUS_WASTE,
        description:
          'Leaking chemical containers and discarded battery acid drums behind Tejgaon workshop.',
        address: 'Industrial Plot 24, Tejgaon, Dhaka, Ward 24',
        street: 'Industrial Plot 24',
        area: 'Tejgaon',
        city: 'Dhaka',
        ward: 'Ward 24',
        latitude: 23.7604,
        longitude: 90.3997,
        priority: ReportPriority.URGENT,
        priorityReason:
          'Classified as URGENT because the report category is Hazardous Waste, requiring immediate containment.',
        matchedRule: 'CATEGORY_HAZARDOUS_WASTE',
        status: ReportStatus.IN_PROGRESS,
        assignedTeamId: teamMap.get('Zone B Hazmat & Spill Response'),
        createdAt: daysAgo(2),
      },
      {
        reportCode: 'CC-DEMO-1002',
        citizenId: citizen._id,
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Public waste container overflowing across the footpath outside Dhanmondi High School.',
        address: 'Road 7A, Dhanmondi, Dhaka, Ward 15',
        street: 'Road 7A',
        area: 'Dhanmondi',
        city: 'Dhaka',
        ward: 'Ward 15',
        latitude: 23.7435,
        longitude: 90.3738,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority because waste is reported near a sensitive public location ("school").',
        matchedRule: 'SENSITIVE_SITE:SCHOOL',
        status: ReportStatus.ASSIGNED,
        assignedTeamId: teamMap.get('Zone A Rapid Sanitation Unit'),
        createdAt: daysAgo(4),
      },
      {
        reportCode: 'CC-DEMO-1003',
        citizenId: citizen._id,
        category: WasteCategory.MISSED_WASTE_COLLECTION,
        description:
          'Door-to-door morning collection truck skipped Block C residential lane.',
        address: 'Road 11, Block C, Banani, Dhaka, Ward 19',
        street: 'Road 11, Block C',
        area: 'Banani',
        city: 'Dhaka',
        ward: 'Ward 19',
        latitude: 23.7937,
        longitude: 90.4066,
        priority: ReportPriority.NORMAL,
        priorityReason:
          'Classified as NORMAL priority for scheduled missed waste collection follow-up.',
        matchedRule: 'CATEGORY_MISSED_COLLECTION',
        status: ReportStatus.RESOLVED,
        assignedTeamId: teamMap.get('Zone C Night Sweeper Crew'),
        resolvedAt: daysAgo(5),
        createdAt: daysAgo(6),
      },
      {
        reportCode: 'CC-DEMO-1004',
        citizenId: citizen._id,
        category: WasteCategory.ILLEGAL_WASTE_DUMPING,
        description:
          'Construction debris and mixed plastic bags dumped next to the neighborhood drainage canal.',
        address: 'Lane 4, Kalabagan, Dhaka, Ward 16',
        street: 'Lane 4',
        area: 'Kalabagan',
        city: 'Dhaka',
        ward: 'Ward 16',
        latitude: 23.7491,
        longitude: 90.3822,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority because illegal dumping with significant accumulation was described.',
        matchedRule: 'ILLEGAL_DUMPING_SIGNIFICANT',
        status: ReportStatus.SUBMITTED,
        assignedTeamId: null,
        createdAt: daysAgo(1),
      },
      {
        reportCode: 'CC-DEMO-1005',
        citizenId: citizen._id,
        category: WasteCategory.OTHER,
        description:
          'Minor scattered paper wrappers along the lakeside walkway benches.',
        address: 'Gulshan Lake Park Walk, Gulshan 2, Dhaka',
        street: 'Lake Park Walk',
        area: 'Gulshan 2',
        city: 'Dhaka',
        ward: 'Ward 19',
        latitude: null,
        longitude: null,
        priority: ReportPriority.LOW,
        priorityReason:
          'Classified as LOW priority as a minor waste issue with no immediate safety hazard.',
        matchedRule: 'LOW_MINOR_ISSUE:MINOR',
        status: ReportStatus.ACKNOWLEDGED,
        assignedTeamId: null,
        createdAt: daysAgo(10),
      },
    ];

    for (const item of demoReports) {
      const created = await ReportModel.create(item);
      await HistoryModel.create({
        reportId: created._id,
        previousStatus: null,
        newStatus: ReportStatus.SUBMITTED,
        changedById: citizen._id,
        note: 'Report submitted by citizen',
        createdAt: item.createdAt,
      });

      if (item.status !== ReportStatus.SUBMITTED) {
        await HistoryModel.create({
          reportId: created._id,
          previousStatus: ReportStatus.SUBMITTED,
          newStatus: item.status,
          changedById: admin._id,
          note: `Updated to ${item.status} during municipal triage`,
          createdAt:
            item.resolvedAt || new Date(item.createdAt.getTime() + 3_600_000),
        });
      }
    }

    console.log(
      '[seed:demo] Demo citizen (citizen.demo@cleancity.local / CitizenPass123!), 3 teams, and 5 reports seeded.',
    );
  } finally {
    await conn.close();
  }
}

if (require.main === module) {
  seedDemoData().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[seed:demo] Failed: ${message}`);
    process.exit(1);
  });
}
