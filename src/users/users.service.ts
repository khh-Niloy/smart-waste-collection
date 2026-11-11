import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { SafeUser, sanitizeUser } from './utils/sanitize-user.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map(sanitizeUser);
  }

  async findOne(id: string): Promise<SafeUser> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return sanitizeUser(user);
  }
}
