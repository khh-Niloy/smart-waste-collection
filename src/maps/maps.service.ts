import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  WasteReport,
  WasteReportDocument,
} from '../reports/schemas/waste-report.schema';
import { MapReportsQueryDto } from './dto/map-reports-query.dto';

@Injectable()
export class MapsService {
  constructor(
    @InjectModel(WasteReport.name)
    private readonly reportModel: Model<WasteReportDocument>,
  ) {}

  async getReportMarkers(query: MapReportsQueryDto) {
    const filter: FilterQuery<WasteReportDocument> = {
      latitude: { $ne: null },
      longitude: { $ne: null },
    };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }

    // Never expose citizen PII or invent coordinates for address-only reports.
    const reports = await this.reportModel
      .find(filter)
      .sort({ createdAt: -1 })
      .select(
        '_id reportCode category priority status address area ward latitude longitude createdAt',
      )
      .lean()
      .exec();

    return reports.map((r) => ({
      id: r._id.toString(),
      reportCode: r.reportCode,
      category: r.category,
      priority: r.priority,
      status: r.status,
      address: r.address,
      area: r.area,
      ward: r.ward,
      latitude: r.latitude,
      longitude: r.longitude,
      createdAt: r.createdAt,
    }));
  }
}

