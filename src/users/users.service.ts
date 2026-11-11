import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
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

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            fullName: dto.fullName.trim(),
            phone: dto.phone?.trim() || undefined,
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return sanitizeUser(updated);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const validCurrent = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!validCurrent) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.userModel
      .findByIdAndUpdate(userId, { $set: { passwordHash } })
      .exec();

    return { message: 'Password updated successfully' };
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
