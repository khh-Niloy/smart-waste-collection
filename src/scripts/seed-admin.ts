import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import mongoose, { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { User, UserSchema } from '../users/schemas/user.schema';

export interface SeedAdminOptions {
  mongodbUri?: string;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export interface SeedAdminResult {
  created: boolean;
  email: string;
}

/**
 * Idempotently seeds the initial ADMIN account from environment variables.
 * Never logs the raw password and never creates duplicate admin accounts.
 */
export async function seedAdmin(
  options: SeedAdminOptions = {},
): Promise<SeedAdminResult> {
  const mongodbUri =
    options.mongodbUri ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/cleancity';
  const adminName = (
    options.adminName ||
    process.env.ADMIN_NAME ||
    'System Administrator'
  ).trim();
  const adminEmail = (options.adminEmail || process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const adminPassword =
    options.adminPassword || process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required to seed the admin account.',
    );
  }

  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  }

  const conn = await mongoose.createConnection(mongodbUri).asPromise();

  try {
    const UserModel: Model<User> = conn.model<User>(User.name, UserSchema);

    const existingAdmin = await UserModel.findOne({
      $or: [{ email: adminEmail }, { role: Role.ADMIN }],
    }).exec();

    if (existingAdmin) {
      return {
        created: false,
        email: existingAdmin.email,
      };
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    await UserModel.create({
      fullName: adminName,
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      hashedRefreshToken: null,
    });

    return {
      created: true,
      email: adminEmail,
    };
  } finally {
    await conn.close();
  }
}

async function runCli(): Promise<void> {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }

  const result = await seedAdmin();
  if (result.created) {
    console.log(`[seed:admin] Admin account created for ${result.email}`);
  } else {
    console.log(
      `[seed:admin] Admin account already exists (${result.email}); skipping creation.`,
    );
  }
}

if (require.main === module) {
  runCli().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[seed:admin] Failed: ${message}`);
    process.exit(1);
  });
}
