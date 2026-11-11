import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { ReportPriority } from '../common/enums/report-priority.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
import { runWithOptionalTransaction } from '../common/utils/transaction.util';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import {
  CollectionTeam,
  CollectionTeamDocument,
} from '../teams/schemas/collection-team.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SafeUser } from '../users/utils/sanitize-user.util';
import { AssignTeamDto } from './dto/assign-team.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { OverridePriorityDto } from './dto/override-priority.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { UpdateReportStatusDto } from './dto/update-status.dto';
import { PriorityClassificationService } from './priority-classification.service';
import {
  ReportStatusHistory,
  ReportStatusHistoryDocument,
} from './schemas/report-status-history.schema';
import {
  WasteReport,
  WasteReportDocument,
} from './schemas/waste-report.schema';

const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.SUBMITTED]: [
    ReportStatus.ACKNOWLEDGED,
    ReportStatus.ASSIGNED,
    ReportStatus.REJECTED,
  ],
  [ReportStatus.ACKNOWLEDGED]: [
    ReportStatus.ASSIGNED,
    ReportStatus.IN_PROGRESS,
    ReportStatus.REJECTED,
  ],
  [ReportStatus.ASSIGNED]: [ReportStatus.IN_PROGRESS, ReportStatus.REJECTED],
  [ReportStatus.IN_PROGRESS]: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
  [ReportStatus.RESOLVED]: [],
  [ReportStatus.REJECTED]: [],
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(WasteReport.name)
    private readonly reportModel: Model<WasteReportDocument>,
    @InjectModel(ReportStatusHistory.name)
    private readonly historyModel: Model<ReportStatusHistoryDocument>,
    @InjectModel(CollectionTeam.name)
    private readonly teamModel: Model<CollectionTeamDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly priorityClassifier: PriorityClassificationService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  async createReport(citizenId: string, dto: CreateReportDto) {
    const citizenObjectId = new Types.ObjectId(citizenId);
    const trimmedAddress = dto.address.trim();
    const trimmedDescription = dto.description.trim();

    // Prevent rapid duplicate submissions within 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const recentDuplicate = await this.reportModel
      .findOne({
        citizenId: citizenObjectId,
        category: dto.category,
        address: trimmedAddress,
        description: trimmedDescription,
        createdAt: { $gte: sixtySecondsAgo },
      })
      .exec();

    if (recentDuplicate) {
      throw new ConflictException(
        'A matching waste report was just submitted. Please wait before submitting again.',
      );
    }

    const classification = this.priorityClassifier.classify({
      category: dto.category,
      description: trimmedDescription,
      address: trimmedAddress,
      area: dto.area,
      ward: dto.ward,
    });

    let createdReportId: Types.ObjectId | null = null;

    const savedReport = await this.createReportWithRetry(async (reportCode) => {
      return runWithOptionalTransaction(
        this.connection,
        async (session) => {
          const [created] = await this.reportModel.create(
            [
              {
                reportCode,
                citizenId: citizenObjectId,
                category: dto.category,
                description: trimmedDescription,
                address: trimmedAddress,
                ...(dto.street?.trim() ? { street: dto.street.trim() } : {}),
                ...(dto.area?.trim() ? { area: dto.area.trim() } : {}),
                ...(dto.city?.trim() ? { city: dto.city.trim() } : {}),
                ...(dto.ward?.trim() ? { ward: dto.ward.trim() } : {}),
                latitude:
                  typeof dto.latitude === 'number' ? dto.latitude : null,
                longitude:
                  typeof dto.longitude === 'number' ? dto.longitude : null,
                photoUrl: dto.photoUrl?.trim() || null,
                priority: classification.priority,
                priorityReason: classification.explanation,
                matchedRule: classification.matchedRule,
                status: ReportStatus.SUBMITTED,
              },
            ],
            session ? { session } : undefined,
          );

          createdReportId = created._id;

          await this.historyModel.create(
            [
              {
                reportId: created._id,
                previousStatus: null,
                newStatus: ReportStatus.SUBMITTED,
                changedById: citizenObjectId,
                note: 'Report submitted by citizen',
              },
            ],
            session ? { session } : undefined,
          );

          return created;
        },
        async () => {
          if (createdReportId) {
            await this.reportModel.findByIdAndDelete(createdReportId).exec();
          }
        },
      );
    });

    return this.attachSignedPhotoUrl(savedReport.toObject());
  }

  async getCitizenSummary(citizenId: string) {
    const citizenObjectId = new Types.ObjectId(citizenId);

    const statusAggregation = await this.reportModel
      .aggregate<{ _id: ReportStatus; count: number }>([
        { $match: { citizenId: citizenObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const countByStatus: Record<string, number> = {};
    let total = 0;
    for (const row of statusAggregation) {
      countByStatus[row._id] = row.count;
      total += row.count;
    }

    const pending =
      (countByStatus[ReportStatus.SUBMITTED] || 0) +
      (countByStatus[ReportStatus.ACKNOWLEDGED] || 0) +
      (countByStatus[ReportStatus.ASSIGNED] || 0);

    const inProgress = countByStatus[ReportStatus.IN_PROGRESS] || 0;
    const resolved = countByStatus[ReportStatus.RESOLVED] || 0;
    const rejected = countByStatus[ReportStatus.REJECTED] || 0;

    const recentReports = await this.reportModel
      .find({ citizenId: citizenObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate(
        'assignedTeamId',
        'teamName contactPerson phone serviceArea isActive',
      )
      .lean()
      .exec();

    return {
      total,
      pending,
      inProgress,
      resolved,
      rejected,
      recentReports: await Promise.all(
        recentReports.map((r) => this.attachSignedPhotoUrl(r)),
      ),
    };
  }

  async findMyReports(citizenId: string, query: QueryReportsDto) {
    const filter: FilterQuery<WasteReportDocument> = {
      citizenId: new Types.ObjectId(citizenId),
    };

    if (query.category) {
      filter.category = query.category;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search?.trim()) {
      const regex = new RegExp(this.escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ reportCode: regex }, { address: regex }];
    }

    return this.paginateReports(filter, query);
  }

  async findAllForAdmin(query: QueryReportsDto) {
    const filter: FilterQuery<WasteReportDocument> = {};

    if (query.category) {
      filter.category = query.category;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.assignedTeamId) {
      filter.assignedTeamId = new Types.ObjectId(query.assignedTeamId);
    }

    if (query.serviceArea?.trim()) {
      const areaRegex = new RegExp(
        this.escapeRegex(query.serviceArea.trim()),
        'i',
      );
      const matchingTeams = await this.teamModel
        .find({ serviceArea: areaRegex })
        .select('_id')
        .lean()
        .exec();
      filter.assignedTeamId = {
        $in: matchingTeams.map((t) => t._id),
      };
    }

    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) {
        dateFilter.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length <= 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
        dateFilter.$lte = end;
      }
      filter.createdAt = dateFilter;
    }

    if (query.search?.trim()) {
      const searchRegex = new RegExp(
        this.escapeRegex(query.search.trim()),
        'i',
      );
      const matchingCitizens = await this.userModel
        .find({ fullName: searchRegex })
        .select('_id')
        .lean()
        .exec();
      filter.$or = [
        { reportCode: searchRegex },
        { address: searchRegex },
        { description: searchRegex },
        ...(matchingCitizens.length > 0
          ? [{ citizenId: { $in: matchingCitizens.map((u) => u._id) } }]
          : []),
      ];
    }

    return this.paginateReports(filter, query);
  }

  async findOneById(
    id: string,
    requester: SafeUser,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid report ID format');
    }

    const report = await this.reportModel
      .findById(id)
      .populate('citizenId', 'fullName email phone role')
      .populate(
        'assignedTeamId',
        'teamName contactPerson phone serviceArea isActive',
      )
      .populate('priorityOverriddenById', 'fullName role')
      .populate('priorityHistory.changedById', 'fullName role')
      .lean()
      .exec();

    if (!report) {
      throw new NotFoundException('Waste report not found');
    }

    const ownerId =
      report.citizenId &&
      typeof report.citizenId === 'object' &&
      '_id' in report.citizenId
        ? String((report.citizenId as { _id: Types.ObjectId })._id)
        : String(report.citizenId);

    if (requester.role === Role.CITIZEN && ownerId !== requester.id) {
      throw new ForbiddenException(
        'You do not have permission to access this report',
      );
    }

    const statusHistory = await this.historyModel
      .find({ reportId: report._id })
      .sort({ createdAt: 1 })
      .populate('changedById', 'fullName role')
      .lean()
      .exec();

    const withPhoto = await this.attachSignedPhotoUrl(report);
    return {
      ...withPhoto,
      statusHistory,
    };
  }

  async updateStatus(
    id: string,
    adminId: string,
    dto: UpdateReportStatusDto,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid report ID format');
    }

    const report = await this.reportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException('Waste report not found');
    }

    if (report.status === dto.status) {
      throw new BadRequestException(
        `Report is already in ${dto.status} status`,
      );
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[report.status] || [];
    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${report.status} to ${dto.status}`,
      );
    }

    const trimmedNote = dto.note?.trim() || '';
    if (dto.status === ReportStatus.REJECTED && !trimmedNote) {
      throw new BadRequestException(
        'A rejection reason note is required when rejecting a report',
      );
    }

    const previousStatus = report.status;
    const previousResolvedAt = report.resolvedAt || null;
    const newResolvedAt =
      dto.status === ReportStatus.RESOLVED ? new Date() : previousResolvedAt;

    await runWithOptionalTransaction(
      this.connection,
      async (session) => {
        const updated = await this.reportModel
          .findOneAndUpdate(
            { _id: report._id, status: previousStatus },
            {
              $set: {
                status: dto.status,
                resolvedAt: newResolvedAt,
              },
            },
            { new: true, ...(session ? { session } : {}) },
          )
          .exec();

        if (!updated) {
          throw new ConflictException(
            'Report status was updated concurrently. Please refresh and try again.',
          );
        }

        await this.historyModel.create(
          [
            {
              reportId: report._id,
              previousStatus,
              newStatus: dto.status,
              changedById: new Types.ObjectId(adminId),
              note:
                trimmedNote ||
                `Status updated from ${previousStatus} to ${dto.status}`,
            },
          ],
          session ? { session } : undefined,
        );
      },
      async () => {
        await this.reportModel
          .findByIdAndUpdate(report._id, {
            $set: {
              status: previousStatus,
              resolvedAt: previousResolvedAt,
            },
          })
          .exec();
      },
    );

    return this.findOneById(id, {
      id: adminId,
      fullName: '',
      email: '',
      role: Role.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async assignTeam(
    id: string,
    adminId: string,
    dto: AssignTeamDto,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid report ID format');
    }

    const team = await this.teamModel.findById(dto.teamId).exec();
    if (!team) {
      throw new NotFoundException('Collection team not found');
    }
    if (!team.isActive) {
      throw new BadRequestException(
        'Inactive collection teams cannot be assigned to reports',
      );
    }

    const report = await this.reportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException('Waste report not found');
    }

    if (
      report.status === ReportStatus.RESOLVED ||
      report.status === ReportStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot assign a team to a ${report.status} report`,
      );
    }

    const previousStatus = report.status;
    const previousTeamId = report.assignedTeamId || null;
    const nextStatus =
      previousStatus === ReportStatus.SUBMITTED ||
      previousStatus === ReportStatus.ACKNOWLEDGED
        ? ReportStatus.ASSIGNED
        : previousStatus;

    await runWithOptionalTransaction(
      this.connection,
      async (session) => {
        const updated = await this.reportModel
          .findOneAndUpdate(
            {
              _id: report._id,
              status: previousStatus,
            },
            {
              $set: {
                assignedTeamId: team._id,
                status: nextStatus,
              },
            },
            { new: true, ...(session ? { session } : {}) },
          )
          .exec();

        if (!updated) {
          throw new ConflictException(
            'Report was modified concurrently. Please refresh and try again.',
          );
        }

        await this.historyModel.create(
          [
            {
              reportId: report._id,
              previousStatus,
              newStatus: nextStatus,
              changedById: new Types.ObjectId(adminId),
              note:
                dto.note?.trim() ||
                `Assigned collection team: ${team.teamName} (${team.serviceArea})`,
            },
          ],
          session ? { session } : undefined,
        );
      },
      async () => {
        await this.reportModel
          .findByIdAndUpdate(report._id, {
            $set: {
              assignedTeamId: previousTeamId,
              status: previousStatus,
            },
          })
          .exec();
      },
    );

    return this.findOneById(id, {
      id: adminId,
      fullName: '',
      email: '',
      role: Role.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async overridePriority(
    id: string,
    adminId: string,
    dto: OverridePriorityDto,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid report ID format');
    }

    const report = await this.reportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException('Waste report not found');
    }

    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Override reason is required');
    }

    const previousPriority = report.priority;
    if (previousPriority === dto.priority) {
      throw new BadRequestException(
        `Report priority is already ${dto.priority}`,
      );
    }

    const adminObjectId = new Types.ObjectId(adminId);
    const changedAt = new Date();

    await this.reportModel
      .findByIdAndUpdate(report._id, {
        $set: {
          priority: dto.priority,
          priorityOverrideReason: reason,
          priorityOverriddenById: adminObjectId,
          priorityOverriddenAt: changedAt,
        },
        $push: {
          priorityHistory: {
            previousPriority,
            newPriority: dto.priority,
            reason,
            changedById: adminObjectId,
            changedAt,
          },
        },
      })
      .exec();

    return this.findOneById(id, {
      id: adminId,
      fullName: '',
      email: '',
      role: Role.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async paginateReports(
    filter: FilterQuery<WasteReportDocument>,
    query: QueryReportsDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ [sortField]: sortDir, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('citizenId', 'fullName email phone')
        .populate(
          'assignedTeamId',
          'teamName contactPerson phone serviceArea isActive',
        )
        .lean()
        .exec(),
      this.reportModel.countDocuments(filter).exec(),
    ]);

    const resolvedItems = await Promise.all(
      items.map((item) => this.attachSignedPhotoUrl(item)),
    );

    return {
      items: resolvedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private async createReportWithRetry<T>(
    createFn: (reportCode: string) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const code = this.generateReportCode();
      try {
        return await createFn(code);
      } catch (err) {
        const isDuplicateCode =
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: number }).code === 11000;
        if (!isDuplicateCode || attempt === maxAttempts) {
          throw err;
        }
      }
    }
    throw new ConflictException('Unable to generate a unique report code');
  }

  private generateReportCode(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `CC-${y}${m}${d}-${suffix}`;
  }

  private async attachSignedPhotoUrl<T extends { photoUrl?: string | null }>(
    report: T,
  ): Promise<T & { photoPreviewUrl: string | null }> {
    const rawKey = report.photoUrl;
    if (!rawKey) {
      return { ...report, photoPreviewUrl: null };
    }

    if (rawKey.startsWith('http://') || rawKey.startsWith('https://')) {
      return { ...report, photoPreviewUrl: rawKey };
    }

    if (!this.storageService.isConfigured()) {
      return { ...report, photoPreviewUrl: null };
    }

    try {
      const previewUrl =
        await this.storageService.createSignedPreviewUrl(rawKey);
      return { ...report, photoPreviewUrl: previewUrl };
    } catch {
      return { ...report, photoPreviewUrl: null };
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export { ReportPriority };
