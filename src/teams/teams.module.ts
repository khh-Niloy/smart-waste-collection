import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WasteReport,
  WasteReportSchema,
} from '../reports/schemas/waste-report.schema';
import {
  CollectionTeam,
  CollectionTeamSchema,
} from './schemas/collection-team.schema';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CollectionTeam.name, schema: CollectionTeamSchema },
      { name: WasteReport.name, schema: WasteReportSchema },
    ]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService, MongooseModule],
})
export class TeamsModule {}
