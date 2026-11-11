import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WasteReport,
  WasteReportSchema,
} from '../reports/schemas/waste-report.schema';
import {
  CollectionTeam,
  CollectionTeamSchema,
} from '../teams/schemas/collection-team.schema';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WasteReport.name, schema: WasteReportSchema },
      { name: CollectionTeam.name, schema: CollectionTeamSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
