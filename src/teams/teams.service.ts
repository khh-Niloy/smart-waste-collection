import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ReportStatus } from '../common/enums/report-status.enum';
import {
  WasteReport,
  WasteReportDocument,
} from '../reports/schemas/waste-report.schema';
import { CreateTeamDto } from './dto/create-team.dto';
import { QueryTeamsDto } from './dto/query-teams.dto';
import { UpdateTeamStatusDto } from './dto/update-team-status.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import {
  CollectionTeam,
  CollectionTeamDocument,
} from './schemas/collection-team.schema';

interface TeamWorkloadAgg {
  _id: Types.ObjectId;
  assignedReportCount: number;
  activeWorkloadCount: number;
  resolvedReportCount: number;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(CollectionTeam.name)
    private readonly teamModel: Model<CollectionTeamDocument>,
    @InjectModel(WasteReport.name)
    private readonly reportModel: Model<WasteReportDocument>,
  ) {}

  async create(dto: CreateTeamDto) {
    const teamName = dto.teamName.trim();
    const existing = await this.teamModel
      .findOne({ teamName: new RegExp(`^${this.escapeRegex(teamName)}$`, 'i') })
      .exec();

    if (existing) {
      throw new ConflictException(
        'A collection team with this name already exists',
      );
    }

    const team = await this.teamModel.create({
      teamName,
      contactPerson: dto.contactPerson.trim(),
      phone: dto.phone.trim(),
      serviceArea: dto.serviceArea.trim(),
      isActive: true,
    });

    return {
      ...team.toObject(),
      assignedReportCount: 0,
      activeWorkloadCount: 0,
      resolvedReportCount: 0,
    };
  }

  async findAll(query: QueryTeamsDto): Promise<Array<Record<string, unknown>>> {
    const filter: FilterQuery<CollectionTeamDocument> = {};

    if (query.isActive === 'true') {
      filter.isActive = true;
    } else if (query.isActive === 'false') {
      filter.isActive = false;
    }

    if (query.serviceArea?.trim()) {
      filter.serviceArea = new RegExp(
        this.escapeRegex(query.serviceArea.trim()),
        'i',
      );
    }

    if (query.search?.trim()) {
      const regex = new RegExp(this.escapeRegex(query.search.trim()), 'i');
      filter.$or = [
        { teamName: regex },
        { contactPerson: regex },
        { serviceArea: regex },
        { phone: regex },
      ];
    }

    const teams = await this.teamModel
      .find(filter)
      .sort({ isActive: -1, teamName: 1 })
      .lean()
      .exec();

    if (teams.length === 0) {
      return [];
    }

    const teamIds = teams.map((t) => t._id);
    const workloadAgg = await this.reportModel
      .aggregate<TeamWorkloadAgg>([
        { $match: { assignedTeamId: { $in: teamIds } } },
        {
          $group: {
            _id: '$assignedTeamId',
            assignedReportCount: { $sum: 1 },
            activeWorkloadCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            resolvedReportCount: {
              $sum: {
                $cond: [{ $eq: ['$status', ReportStatus.RESOLVED] }, 1, 0],
              },
            },
          },
        },
      ])
      .exec();

    const workloadMap = new Map<string, TeamWorkloadAgg>();
    for (const row of workloadAgg) {
      workloadMap.set(row._id.toString(), row);
    }

    return teams.map((team) => {
      const stats = workloadMap.get(team._id.toString());
      return {
        ...team,
        assignedReportCount: stats?.assignedReportCount || 0,
        activeWorkloadCount: stats?.activeWorkloadCount || 0,
        resolvedReportCount: stats?.resolvedReportCount || 0,
      };
    });
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid collection team ID format');
    }

    const team = await this.teamModel.findById(id).lean().exec();
    if (!team) {
      throw new NotFoundException('Collection team not found');
    }

    const assignedReports = await this.reportModel
      .find({ assignedTeamId: team._id })
      .sort({ createdAt: -1 })
      .select(
        'reportCode category priority status address createdAt resolvedAt',
      )
      .lean()
      .exec();

    const activeWorkloadCount = assignedReports.filter(
      (r) =>
        r.status === ReportStatus.ASSIGNED ||
        r.status === ReportStatus.IN_PROGRESS,
    ).length;

    const resolvedReportCount = assignedReports.filter(
      (r) => r.status === ReportStatus.RESOLVED,
    ).length;

    return {
      ...team,
      assignedReportCount: assignedReports.length,
      activeWorkloadCount,
      resolvedReportCount,
      assignedReports,
    };
  }

  async update(
    id: string,
    dto: UpdateTeamDto,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid collection team ID format');
    }

    const existing = await this.teamModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Collection team not found');
    }

    if (dto.teamName?.trim()) {
      const normalizedName = dto.teamName.trim();
      const duplicate = await this.teamModel
        .findOne({
          _id: { $ne: existing._id },
          teamName: new RegExp(`^${this.escapeRegex(normalizedName)}$`, 'i'),
        })
        .exec();
      if (duplicate) {
        throw new ConflictException(
          'Another collection team with this name already exists',
        );
      }
      existing.teamName = normalizedName;
    }

    if (dto.contactPerson?.trim()) {
      existing.contactPerson = dto.contactPerson.trim();
    }
    if (dto.phone?.trim()) {
      existing.phone = dto.phone.trim();
    }
    if (dto.serviceArea?.trim()) {
      existing.serviceArea = dto.serviceArea.trim();
    }

    await existing.save();
    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    dto: UpdateTeamStatusDto,
  ): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid collection team ID format');
    }

    const updated = await this.teamModel
      .findByIdAndUpdate(
        id,
        { $set: { isActive: dto.isActive } },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Collection team not found');
    }

    return this.findOne(id);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
