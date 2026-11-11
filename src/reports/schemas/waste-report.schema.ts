import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { WasteCategory } from '../../common/enums/waste-category.enum';
import { ReportPriority } from '../../common/enums/report-priority.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';

export type WasteReportDocument = HydratedDocument<WasteReport>;

@Schema({
  timestamps: true,
  collection: 'waste_reports',
})
export class WasteReport {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  reportCode: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  citizenId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WasteCategory),
    required: true,
    index: true,
  })
  category: WasteCategory;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 2000 })
  description: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  address: string;

  @Prop({ type: Number, required: false })
  latitude?: number;

  @Prop({ type: Number, required: false })
  longitude?: number;

  @Prop({ type: String, required: false, trim: true })
  photoUrl?: string;

  @Prop({
    type: String,
    enum: Object.values(ReportPriority),
    default: ReportPriority.NORMAL,
    index: true,
  })
  priority: ReportPriority;

  @Prop({ required: true, default: 'Default initial priority', trim: true })
  priorityReason: string;

  @Prop({ type: String, required: false, trim: true })
  priorityOverrideReason?: string;

  @Prop({
    type: String,
    enum: Object.values(ReportStatus),
    default: ReportStatus.SUBMITTED,
    index: true,
  })
  status: ReportStatus;

  @Prop({
    type: Types.ObjectId,
    ref: 'CollectionTeam',
    required: false,
    default: null,
    index: true,
  })
  assignedTeamId?: Types.ObjectId | null;

  @Prop({ type: Date, required: false, default: null })
  resolvedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const WasteReportSchema = SchemaFactory.createForClass(WasteReport);

WasteReportSchema.index({ citizenId: 1, createdAt: -1 });
WasteReportSchema.index({ status: 1, priority: 1, createdAt: -1 });
WasteReportSchema.index({ category: 1, status: 1 });
WasteReportSchema.index({ assignedTeamId: 1, status: 1 });
WasteReportSchema.index({ createdAt: -1 });
