import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ReportPriority } from '../common/enums/report-priority.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { WasteCategory } from '../common/enums/waste-category.enum';
import {
  WasteReport,
  WasteReportDocument,
} from '../reports/schemas/waste-report.schema';
import {
  CollectionTeam,
  CollectionTeamDocument,
} from '../teams/schemas/collection-team.schema';
import { StatisticsQueryDto } from './dto/statistics-query.dto';

interface CountFacetRow {
  _id: string;
  count: number;
}

interface MonthlyTrendRow {
  _id: string;
  total: number;
  resolved: number;
}

interface TeamWorkloadAggRow {
  _id: Types.ObjectId;
  assignedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  totalAssigned: number;
}

interface ResolutionDurationAggRow {
  _id: null;
  avgDurationMs: number;
  resolvedCount: number;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(WasteReport.name)
    private readonly reportModel: Model<WasteReportDocument>,
    @InjectModel(CollectionTeam.name)
    private readonly teamModel: Model<CollectionTeamDocument>,
  ) {}

  async getPublicSummary() {
    const [totalReports, resolvedReports, activeCrews] = await Promise.all([
      this.reportModel.countDocuments().exec(),
      this.reportModel.countDocuments({ status: ReportStatus.RESOLVED }).exec(),
      this.teamModel.countDocuments({ isActive: true }).exec(),
    ]);

    const resolutionRate =
      totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

    return {
      totalReports,
      resolvedReports,
      activeCrews,
      resolutionRate,
    };
  }

  async getOverview(query: StatisticsQueryDto) {
    const matchFilter: FilterQuery<WasteReportDocument> = {};
    if (query.startDate || query.endDate) {
      const dateRange: Record<string, Date> = {};
      if (query.startDate) {
        dateRange.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length <= 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
        dateRange.$lte = end;
      }
      matchFilter.createdAt = dateRange;
    }

    const [
      facetResult,
      activeTeamsCount,
      allTeams,
      teamWorkloadAgg,
      resolutionAgg,
    ] = await Promise.all([
      this.reportModel
        .aggregate<{
          total: Array<{ count: number }>;
          byStatus: CountFacetRow[];
          byCategory: CountFacetRow[];
          byPriority: CountFacetRow[];
          monthlyTrends: MonthlyTrendRow[];
        }>([
          { $match: matchFilter },
          {
            $facet: {
              total: [{ $count: 'count' }],
              byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
              byCategory: [
                { $group: { _id: '$category', count: { $sum: 1 } } },
              ],
              byPriority: [
                { $group: { _id: '$priority', count: { $sum: 1 } } },
              ],
              monthlyTrends: [
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        format: '%Y-%m',
                        date: '$createdAt',
                      },
                    },
                    total: { $sum: 1 },
                    resolved: {
                      $sum: {
                        $cond: [
                          { $eq: ['$status', ReportStatus.RESOLVED] },
                          1,
                          0,
                        ],
                      },
                    },
                  },
                },
                { $sort: { _id: 1 } },
              ],
            },
          },
        ])
        .exec(),
      this.teamModel.countDocuments({ isActive: true }).exec(),
      this.teamModel
        .find()
        .sort({ isActive: -1, teamName: 1 })
        .select('teamName serviceArea isActive')
        .lean()
        .exec(),
      this.reportModel
        .aggregate<TeamWorkloadAggRow>([
          {
            $match: {
              ...matchFilter,
              assignedTeamId: { $ne: null },
            },
          },
          {
            $group: {
              _id: '$assignedTeamId',
              totalAssigned: { $sum: 1 },
              assignedCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', ReportStatus.ASSIGNED] }, 1, 0],
                },
              },
              inProgressCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', ReportStatus.IN_PROGRESS] }, 1, 0],
                },
              },
              resolvedCount: {
                $sum: {
                  $cond: [{ $eq: ['$status', ReportStatus.RESOLVED] }, 1, 0],
                },
              },
            },
          },
        ])
        .exec(),
      this.reportModel
        .aggregate<ResolutionDurationAggRow>([
          {
            $match: {
              ...matchFilter,
              status: ReportStatus.RESOLVED,
              resolvedAt: { $ne: null },
            },
          },
          {
            $group: {
              _id: null,
              avgDurationMs: {
                $avg: { $subtract: ['$resolvedAt', '$createdAt'] },
              },
              resolvedCount: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    const facet = facetResult[0] || {
      total: [],
      byStatus: [],
      byCategory: [],
      byPriority: [],
      monthlyTrends: [],
    };

    const statusMap = new Map<string, number>();
    for (const row of facet.byStatus) {
      statusMap.set(row._id, row.count);
    }

    const categoryMap = new Map<string, number>();
    for (const row of facet.byCategory) {
      categoryMap.set(row._id, row.count);
    }

    const priorityMap = new Map<string, number>();
    for (const row of facet.byPriority) {
      priorityMap.set(row._id, row.count);
    }

    const totalReports = facet.total[0]?.count || 0;
    const submittedReports = statusMap.get(ReportStatus.SUBMITTED) || 0;
    const acknowledgedReports = statusMap.get(ReportStatus.ACKNOWLEDGED) || 0;
    const assignedReports = statusMap.get(ReportStatus.ASSIGNED) || 0;
    const inProgressReports = statusMap.get(ReportStatus.IN_PROGRESS) || 0;
    const resolvedReports = statusMap.get(ReportStatus.RESOLVED) || 0;
    const rejectedReports = statusMap.get(ReportStatus.REJECTED) || 0;
    const pendingReports =
      submittedReports +
      acknowledgedReports +
      assignedReports +
      inProgressReports;
    const urgentHighReports =
      (priorityMap.get(ReportPriority.URGENT) || 0) +
      (priorityMap.get(ReportPriority.HIGH) || 0);

    const workloadMap = new Map<string, TeamWorkloadAggRow>();
    for (const row of teamWorkloadAgg) {
      workloadMap.set(row._id.toString(), row);
    }

    const teamWorkload = allTeams.map((team) => {
      const stats = workloadMap.get(team._id.toString());
      return {
        teamId: team._id.toString(),
        teamName: team.teamName,
        serviceArea: team.serviceArea,
        isActive: team.isActive,
        assignedCount: stats?.assignedCount || 0,
        inProgressCount: stats?.inProgressCount || 0,
        resolvedCount: stats?.resolvedCount || 0,
        totalAssigned: stats?.totalAssigned || 0,
      };
    });

    const avgMs = resolutionAgg[0]?.avgDurationMs || 0;
    const averageResolutionHours =
      avgMs > 0 ? Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10 : 0;
    const resolutionRate =
      totalReports > 0
        ? Math.round((resolvedReports / totalReports) * 1000) / 10
        : 0;

    return {
      summary: {
        totalReports,
        submittedReports,
        acknowledgedReports,
        assignedReports,
        inProgressReports,
        resolvedReports,
        rejectedReports,
        pendingReports,
        urgentHighReports,
        activeTeamsCount,
      },
      byCategory: Object.values(WasteCategory).map((category) => ({
        category,
        count: categoryMap.get(category) || 0,
      })),
      byStatus: Object.values(ReportStatus).map((status) => ({
        status,
        count: statusMap.get(status) || 0,
      })),
      byPriority: Object.values(ReportPriority).map((priority) => ({
        priority,
        count: priorityMap.get(priority) || 0,
      })),
      monthlyTrends: facet.monthlyTrends.map((row) => ({
        month: row._id,
        total: row.total,
        resolved: row.resolved,
      })),
      teamWorkload,
      resolutionStats: {
        resolvedCount: resolvedReports,
        resolutionRate,
        averageResolutionHours,
      },
    };
  }
}
