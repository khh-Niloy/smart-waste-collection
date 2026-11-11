import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReportPriority } from '../../common/enums/report-priority.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { WasteCategory } from '../../common/enums/waste-category.enum';

export type WasteReportDocument = HydratedDocument<WasteReport>;

@Schema({ _id: false })
export class PriorityOverrideEntry {
  @Prop({ type: String, enum: Object.values(ReportPriority), required: true })
  previousPriority: ReportPriority;

  @Prop({ type: String, enum: Object.values(ReportPriority), required: true })
  newPriority: ReportPriority;

  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  changedById: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  changedAt: Date;
}

export const PriorityOverrideEntrySchema = SchemaFactory.createForClass(
  PriorityOverrideEntry,
);

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

  @Prop({ type: String, required: false, trim: true, maxlength: 180 })
  street?: string;

  @Prop({ type: String, required: false, trim: true, maxlength: 150 })
  area?: string;

  @Prop({ type: String, required: false, trim: true, maxlength: 120 })
  city?: string;

  @Prop({ type: String, required: false, trim: true, maxlength: 80 })
  ward?: string;

  @Prop({ type: Number, required: false, default: null })
  latitude?: number | null;

  @Prop({ type: Number, required: false, default: null })
  longitude?: number | null;

  @Prop({ type: String, required: false, trim: true, default: null })
  photoUrl?: string | null;

  @Prop({
    type: String,
    enum: Object.values(ReportPriority),
    default: ReportPriority.NORMAL,
    index: true,
  })
  priority: ReportPriority;

  @Prop({ required: true, default: 'Default initial priority', trim: true })
  priorityReason: string;

  @Prop({ type: String, required: false, trim: true, default: null })
  matchedRule?: string | null;

  @Prop({ type: String, required: false, trim: true, default: null })
  priorityOverrideReason?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  priorityOverriddenById?: Types.ObjectId | null;

  @Prop({ type: Date, required: false, default: null })
  priorityOverriddenAt?: Date | null;

  @Prop({ type: [PriorityOverrideEntrySchema], default: [] })
  priorityHistory: PriorityOverrideEntry[];

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
WasteReportSchema.index({ latitude: 1, longitude: 1 });
