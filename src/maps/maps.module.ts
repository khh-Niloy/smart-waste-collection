import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WasteReport,
  WasteReportSchema,
} from '../reports/schemas/waste-report.schema';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WasteReport.name, schema: WasteReportSchema },
    ]),
  ],
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}

