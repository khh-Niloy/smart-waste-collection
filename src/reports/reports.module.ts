import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from '../storage/storage.module';
import {
  CollectionTeam,
  CollectionTeamSchema,
} from '../teams/schemas/collection-team.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PriorityClassificationService } from './priority-classification.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import {
  ReportStatusHistory,
  ReportStatusHistorySchema,
} from './schemas/report-status-history.schema';
import { WasteReport, WasteReportSchema } from './schemas/waste-report.schema';

@Module({
  imports: [
    StorageModule,
    MongooseModule.forFeature([
      { name: WasteReport.name, schema: WasteReportSchema },
      { name: ReportStatusHistory.name, schema: ReportStatusHistorySchema },
      { name: CollectionTeam.name, schema: CollectionTeamSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PriorityClassificationService],
  exports: [ReportsService, PriorityClassificationService, MongooseModule],
})
export class ReportsModule {}
