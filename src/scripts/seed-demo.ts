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

    // 1. Seed 10 Citizens (11+ total users with admin)
    const citizenPasswordHash = await bcrypt.hash('CitizenPass123!', 10);
    const citizenProfiles = [
      {
        fullName: 'Hasib Hossain Niloy',
        email: 'citizen.demo@cleancity.local',
        phone: '+8801711554433',
      },
      {
        fullName: 'Nadia Karim',
        email: 'nadia.karim@cleancity.local',
        phone: '+8801711554401',
      },
      {
        fullName: 'Tanvir Ahmed',
        email: 'tanvir.ahmed@cleancity.local',
        phone: '+8801711554402',
      },
      {
        fullName: 'Sadia Afrin',
        email: 'sadia.afrin@cleancity.local',
        phone: '+8801711554403',
      },
      {
        fullName: 'Mehedi Hasan',
        email: 'mehedi.hasan@cleancity.local',
        phone: '+8801711554404',
      },
      {
        fullName: 'Farzana Yasmin',
        email: 'farzana.yasmin@cleancity.local',
        phone: '+8801711554405',
      },
      {
        fullName: 'Imran Chowdhury',
        email: 'imran.chowdhury@cleancity.local',
        phone: '+8801711554406',
      },
      {
        fullName: 'Nusrat Jahan',
        email: 'nusrat.jahan@cleancity.local',
        phone: '+8801711554407',
      },
      {
        fullName: 'Ariful Islam',
        email: 'ariful.islam@cleancity.local',
        phone: '+8801711554408',
      },
      {
        fullName: 'Tasnim Sultana',
        email: 'tasnim.sultana@cleancity.local',
        phone: '+8801711554409',
      },
    ];

    const seededCitizens: Array<{ _id: Types.ObjectId; email: string }> = [];
    for (const profile of citizenProfiles) {
      let existing = await UserModel.findOne({ email: profile.email }).exec();
      if (!existing) {
        existing = await UserModel.create({
          ...profile,
          passwordHash: citizenPasswordHash,
          role: Role.CITIZEN,
          isActive: true,
          hashedRefreshToken: null,
        });
      }
      seededCitizens.push({ _id: existing._id, email: existing.email });
    }
    const primaryCitizenId = seededCitizens[0]._id;
    const secondaryCitizenId = seededCitizens[1]._id;

    // 2. Seed 10 Collection Teams
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
      {
        teamName: 'Mirpur North Compactor Team',
        contactPerson: 'Kamrul Hasan',
        phone: '+8801714004455',
        serviceArea: 'Mirpur 10 & Pallabi',
        isActive: true,
      },
      {
        teamName: 'Uttara Sector Eco Unit',
        contactPerson: 'Shabnam Parvin',
        phone: '+8801815005566',
        serviceArea: 'Uttara Sectors 4–9',
        isActive: true,
      },
      {
        teamName: 'Mohammadpur Ward Patrol',
        contactPerson: 'Zahirul Haque',
        phone: '+8801916006677',
        serviceArea: 'Mohammadpur & Lalmatia',
        isActive: true,
      },
      {
        teamName: 'Motijheel Commercial Crew',
        contactPerson: 'Anisur Rahman',
        phone: '+8801717007788',
        serviceArea: 'Motijheel & Paltan',
        isActive: true,
      },
      {
        teamName: 'Badda Drainage Clearance Unit',
        contactPerson: 'Mizanur Rahman',
        phone: '+8801818008899',
        serviceArea: 'Badda & Rampura',
        isActive: true,
      },
      {
        teamName: 'Khilgaon Morning Pickup Squad',
        contactPerson: 'Sumon Mia',
        phone: '+8801919009900',
        serviceArea: 'Khilgaon & Basabo',
        isActive: true,
      },
      {
        teamName: 'Old Dhaka Heritage Reserve Crew',
        contactPerson: 'Habibur Rahman',
        phone: '+8801710001010',
        serviceArea: 'Lalbagh & Chawkbazar',
        isActive: false,
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

    // 3. Seed 14 realistic WasteReports (12 for primary citizen: 3 Resolved, 5 In Progress, 4 Pending)
    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 86_400_000);

    const demoReports = [
      {
        reportCode: 'CC-2026-0012',
        citizenId: primaryCitizenId,
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Public waste bin overflowing across the pedestrian walkway near Dhanmondi 27 intersection.',
        address: 'Dhanmondi 27, Dhaka',
        street: 'Road 27',
        area: 'Dhanmondi',
        city: 'Dhaka',
        ward: 'Ward 15',
        latitude: 23.7511,
        longitude: 90.3775,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority because waste is reported in a congested corridor blocking pedestrians.',
        matchedRule: 'HIGH_DISRUPTION:OVERFLOWING',
        status: ReportStatus.IN_PROGRESS,
        assignedTeamId: teamMap.get('Zone A Rapid Sanitation Unit'),
        createdAt: daysAgo(1),
      },
      {
        reportCode: 'CC-2026-0011',
        citizenId: primaryCitizenId,
        category: WasteCategory.ILLEGAL_WASTE_DUMPING,
        description:
          'Unauthorized pile of construction rubble and mixed waste bags dumped beside Mirpur 10 road.',
        address: 'Mirpur 10, Dhaka',
        street: 'Begum Rokeya Sarani',
        area: 'Mirpur 10',
        city: 'Dhaka',
        ward: 'Ward 14',
        latitude: 23.8069,
        longitude: 90.3687,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority because illegal dumping with significant accumulation was described.',
        matchedRule: 'ILLEGAL_DUMPING_SIGNIFICANT',
        status: ReportStatus.ASSIGNED,
        assignedTeamId: teamMap.get('Mirpur North Compactor Team'),
        createdAt: daysAgo(2),
      },
      {
        reportCode: 'CC-2026-0010',
        citizenId: primaryCitizenId,
        category: WasteCategory.MISSED_WASTE_COLLECTION,
        description:
          'Scheduled door-to-door morning collection missed Sector 6 residential lane.',
        address: 'Uttara, Sector 6',
        street: 'Road 4, Sector 6',
        area: 'Uttara',
        city: 'Dhaka',
        ward: 'Ward 1',
        latitude: 23.8759,
        longitude: 90.3995,
        priority: ReportPriority.NORMAL,
        priorityReason:
          'Classified as NORMAL priority for scheduled missed waste collection follow-up.',
        matchedRule: 'CATEGORY_MISSED_COLLECTION',
        status: ReportStatus.RESOLVED,
        assignedTeamId: teamMap.get('Uttara Sector Eco Unit'),
        resolvedAt: daysAgo(2),
        createdAt: daysAgo(3),
      },
      {
        reportCode: 'CC-2026-0009',
        citizenId: primaryCitizenId,
        category: WasteCategory.HAZARDOUS_WASTE,
        description:
          'Discarded chemical containers and leaking battery fluid near Tejgaon industrial alley.',
        address: 'Tejgaon Industrial Area, Dhaka',
        street: 'Plot 24, Industrial Road',
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
        createdAt: daysAgo(4),
      },
      {
        reportCode: 'CC-2026-0008',
        citizenId: primaryCitizenId,
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Overflowing market bin emitting strong odor beside Banani Kitchen Market.',
        address: 'Road 11, Banani, Dhaka',
        street: 'Road 11',
        area: 'Banani',
        city: 'Dhaka',
        ward: 'Ward 19',
        latitude: 23.7937,
        longitude: 90.4066,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority because waste is reported near a sensitive public location ("market").',
        matchedRule: 'SENSITIVE_SITE:MARKET',
        status: ReportStatus.IN_PROGRESS,
        assignedTeamId: teamMap.get('Zone C Night Sweeper Crew'),
        createdAt: daysAgo(5),
      },
      {
        reportCode: 'CC-2026-0007',
        citizenId: primaryCitizenId,
        category: WasteCategory.ILLEGAL_WASTE_DUMPING,
        description:
          'Mixed household bags and plastic refuse dumped along Badda drainage culvert.',
        address: 'Middle Badda, Dhaka',
        street: 'Post Office Road',
        area: 'Badda',
        city: 'Dhaka',
        ward: 'Ward 21',
        latitude: 23.7805,
        longitude: 90.4267,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority due to significant accumulation near drainage.',
        matchedRule: 'ILLEGAL_DUMPING_SIGNIFICANT',
        status: ReportStatus.IN_PROGRESS,
        assignedTeamId: teamMap.get('Badda Drainage Clearance Unit'),
        createdAt: daysAgo(6),
      },
      {
        reportCode: 'CC-2026-0006',
        citizenId: primaryCitizenId,
        category: WasteCategory.MISSED_WASTE_COLLECTION,
        description:
          'Evening waste van skipped residential block near Tajmahal Road.',
        address: 'Tajmahal Road, Mohammadpur, Dhaka',
        street: 'Tajmahal Road',
        area: 'Mohammadpur',
        city: 'Dhaka',
        ward: 'Ward 31',
        latitude: 23.7654,
        longitude: 90.3612,
        priority: ReportPriority.NORMAL,
        priorityReason:
          'Classified as NORMAL priority for scheduled missed waste collection follow-up.',
        matchedRule: 'CATEGORY_MISSED_COLLECTION',
        status: ReportStatus.IN_PROGRESS,
        assignedTeamId: teamMap.get('Mohammadpur Ward Patrol'),
        createdAt: daysAgo(7),
      },
      {
        reportCode: 'CC-2026-0005',
        citizenId: primaryCitizenId,
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Street corner bin full to capacity near Motijheel commercial arcade.',
        address: 'Motijheel C/A, Dhaka',
        street: 'Dilkusha Road',
        area: 'Motijheel',
        city: 'Dhaka',
        ward: 'Ward 9',
        latitude: 23.733,
        longitude: 90.4172,
        priority: ReportPriority.NORMAL,
        priorityReason:
          'Classified as NORMAL priority as a standard municipal waste collection issue.',
        matchedRule: 'STANDARD_COLLECTION_ISSUE',
        status: ReportStatus.SUBMITTED,
        assignedTeamId: null,
        createdAt: daysAgo(8),
      },
      {
        reportCode: 'CC-2026-0004',
        citizenId: primaryCitizenId,
        category: WasteCategory.OTHER,
        description:
          'Minor scattered paper wrappers along Gulshan Lake Park footpath.',
        address: 'Gulshan 2 Lake Walk, Dhaka',
        street: 'Road 71',
        area: 'Gulshan 2',
        city: 'Dhaka',
        ward: 'Ward 19',
        latitude: 23.7925,
        longitude: 90.4152,
        priority: ReportPriority.LOW,
        priorityReason:
          'Classified as LOW priority as a minor waste issue with no immediate safety hazard.',
        matchedRule: 'LOW_MINOR_ISSUE:MINOR',
        status: ReportStatus.ACKNOWLEDGED,
        assignedTeamId: null,
        createdAt: daysAgo(9),
      },
      {
        reportCode: 'CC-2026-0003',
        citizenId: primaryCitizenId,
        category: WasteCategory.MISSED_WASTE_COLLECTION,
        description: 'Scheduled pickup missed on Khilgaon Taltola side street.',
        address: 'Khilgaon Taltola, Dhaka',
        street: 'Block B Lane 3',
        area: 'Khilgaon',
        city: 'Dhaka',
        ward: 'Ward 23',
        latitude: 23.7518,
        longitude: 90.4252,
        priority: ReportPriority.NORMAL,
        priorityReason:
          'Classified as NORMAL priority for scheduled missed waste collection follow-up.',
        matchedRule: 'CATEGORY_MISSED_COLLECTION',
        status: ReportStatus.SUBMITTED,
        assignedTeamId: null,
        createdAt: daysAgo(10),
      },
      {
        reportCode: 'CC-2026-0002',
        citizenId: primaryCitizenId,
        category: WasteCategory.OVERFLOWING_GARBAGE_BIN,
        description:
          'Public waste bin outside Kalabagan clinic cleared and sanitized.',
        address: 'Kalabagan Bus Stand, Dhaka',
        street: 'Mirpur Road',
        area: 'Kalabagan',
        city: 'Dhaka',
        ward: 'Ward 16',
        latitude: 23.7491,
        longitude: 90.3822,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority because waste is reported near a sensitive public location ("clinic").',
        matchedRule: 'SENSITIVE_SITE:CLINIC',
        status: ReportStatus.RESOLVED,
        assignedTeamId: teamMap.get('Zone A Rapid Sanitation Unit'),
        resolvedAt: daysAgo(11),
        createdAt: daysAgo(13),
      },
      {
        reportCode: 'CC-2026-0001',
        citizenId: primaryCitizenId,
        category: WasteCategory.OTHER,
        description:
          'Fallen tree branches and dry leaves gathered beside Dhanmondi Lake bridge.',
        address: 'Road 8, Dhanmondi, Dhaka',
        street: 'Road 8',
        area: 'Dhanmondi',
        city: 'Dhaka',
        ward: 'Ward 15',
        latitude: 23.7435,
        longitude: 90.3738,
        priority: ReportPriority.LOW,
        priorityReason:
          'Classified as LOW priority for general non-hazardous waste inquiry.',
        matchedRule: 'CATEGORY_OTHER_MINOR',
        status: ReportStatus.RESOLVED,
        assignedTeamId: teamMap.get('Zone A Rapid Sanitation Unit'),
        resolvedAt: daysAgo(14),
        createdAt: daysAgo(16),
      },
      {
        reportCode: 'CC-2026-0013',
        citizenId: secondaryCitizenId,
        category: WasteCategory.ILLEGAL_WASTE_DUMPING,
        description:
          'Discarded furniture and demolition debris stacked near Karwan Bazar rail crossing.',
        address: 'Karwan Bazar, Dhaka',
        street: 'Kazi Nazrul Islam Ave',
        area: 'Karwan Bazar',
        city: 'Dhaka',
        ward: 'Ward 26',
        latitude: 23.7516,
        longitude: 90.3943,
        priority: ReportPriority.HIGH,
        priorityReason:
          'Classified as HIGH priority due to public obstruction.',
        matchedRule: 'HIGH_DISRUPTION:TRAFFIC',
        status: ReportStatus.ASSIGNED,
        assignedTeamId: teamMap.get('Zone B Hazmat & Spill Response'),
        createdAt: daysAgo(3),
      },
      {
        reportCode: 'CC-2026-0014',
        citizenId: secondaryCitizenId,
        category: WasteCategory.MISSED_WASTE_COLLECTION,
        description: 'Residential block pickup skipped on Green Road lane.',
        address: 'Green Road, Dhaka',
        street: 'Green Road',
        area: 'Panthapath',
        city: 'Dhaka',
        ward: 'Ward 16',
        latitude: null,
        longitude: null,
        priority: ReportPriority.NORMAL,
        priorityReason:
          'Classified as NORMAL priority for scheduled missed waste collection follow-up.',
        matchedRule: 'CATEGORY_MISSED_COLLECTION',
        status: ReportStatus.ACKNOWLEDGED,
        assignedTeamId: null,
        createdAt: daysAgo(4),
      },
    ];

    let insertedReports = 0;
    for (const item of demoReports) {
      const existingReport = await ReportModel.findOne({
        reportCode: item.reportCode,
      }).exec();
      if (existingReport) continue;

      const created = await ReportModel.create(item);
      insertedReports += 1;

      await HistoryModel.create({
        reportId: created._id,
        previousStatus: null,
        newStatus: ReportStatus.SUBMITTED,
        changedById: item.citizenId,
        note: 'Report submitted by citizen',
        createdAt: item.createdAt,
      });

      if (item.status !== ReportStatus.SUBMITTED) {
        await HistoryModel.create({
          reportId: created._id,
          previousStatus: ReportStatus.SUBMITTED,
          newStatus: item.status,
          changedById: admin._id,
          note: `Updated to ${item.status} during municipal dispatch`,
          createdAt:
            item.resolvedAt || new Date(item.createdAt.getTime() + 3_600_000),
        });
      }
    }

    const [usersCount, teamsCount, reportsCount, historyCount] =
      await Promise.all([
        UserModel.countDocuments().exec(),
        TeamModel.countDocuments().exec(),
        ReportModel.countDocuments().exec(),
        HistoryModel.countDocuments().exec(),
      ]);

    console.log(
      `[seed:demo] Seed complete (added ${insertedReports} reports). Collection counts -> users: ${usersCount}, collection_teams: ${teamsCount}, waste_reports: ${reportsCount}, report_status_histories: ${historyCount}`,
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
