import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CollectionTeamDocument = HydratedDocument<CollectionTeam>;

@Schema({
  timestamps: true,
  collection: 'collection_teams',
})
export class CollectionTeam {
  @Prop({ required: true, unique: true, trim: true, maxlength: 120 })
  teamName: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  contactPerson: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  phone: string;

  @Prop({ required: true, trim: true, maxlength: 150, index: true })
  serviceArea: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const CollectionTeamSchema =
  SchemaFactory.createForClass(CollectionTeam);

CollectionTeamSchema.index({ isActive: 1, serviceArea: 1 });
