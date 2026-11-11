import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ReportStatusHistory,
  ReportStatusHistorySchema,
} from './schemas/report-status-history.schema';
import { WasteReport, WasteReportSchema } from './schemas/waste-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WasteReport.name, schema: WasteReportSchema },
      { name: ReportStatusHistory.name, schema: ReportStatusHistorySchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class ReportsModule {}
