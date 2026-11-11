import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReportStatus } from '../../common/enums/report-status.enum';

export type ReportStatusHistoryDocument = HydratedDocument<ReportStatusHistory>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'report_status_histories',
})
export class ReportStatusHistory {
  @Prop({
    type: Types.ObjectId,
    ref: 'WasteReport',
    required: true,
    index: true,
  })
  reportId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ReportStatus),
    required: false,
    default: null,
  })
  previousStatus?: ReportStatus | null;

  @Prop({
    type: String,
    enum: Object.values(ReportStatus),
    required: true,
  })
  newStatus: ReportStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  changedById: Types.ObjectId;

  @Prop({ type: String, default: '', trim: true, maxlength: 500 })
  note: string;

  createdAt: Date;
}

export const ReportStatusHistorySchema =
  SchemaFactory.createForClass(ReportStatusHistory);

ReportStatusHistorySchema.index({ reportId: 1, createdAt: 1 });
