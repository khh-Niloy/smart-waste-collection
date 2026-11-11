import { UserDocument } from '../schemas/user.schema';
import { Role } from '../../common/enums/role.enum';

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Strips sensitive authentication fields (passwordHash, hashedRefreshToken)
 * before returning user data in API responses or attaching to request context.
 */
export function sanitizeUser(user: UserDocument): SafeUser {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    ...(user.phone ? { phone: user.phone } : {}),
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
