import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  collection: 'users',
  toJSON: {
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = String(ret._id);
      delete ret.passwordHash;
      delete ret.hashedRefreshToken;
      delete ret.__v;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  fullName: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop({ required: false, trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, default: null })
  hashedRefreshToken: string | null;

  @Prop({
    type: String,
    enum: Object.values(Role),
    default: Role.CITIZEN,
    index: true,
  })
  role: Role;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1, isActive: 1 });
