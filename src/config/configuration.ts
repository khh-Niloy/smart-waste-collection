export interface AppConfiguration {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cors: {
    clientUrls: string[];
  };
  cookie: {
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };
  supabase: {
    url: string;
    secretKey: string;
    bucket: string;
  };
}

export default (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const rawOrigins = process.env.CLIENT_URL || 'http://localhost:3000';
  const clientUrls = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const cookieSecure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : isProd;

  const cookieSameSite =
    (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ||
    (isProd ? 'none' : 'lax');

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv,
    mongodbUri:
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cleancity',
    jwt: {
      accessSecret:
        process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshSecret:
        process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    cors: {
      clientUrls,
    },
    cookie: {
      secure: cookieSecure,
      sameSite: cookieSameSite,
    },
    supabase: {
      url: process.env.SUPABASE_URL || '',
      secretKey:
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        '',
      bucket: process.env.SUPABASE_STORAGE_BUCKET || 'waste-reports',
    },
  };
};
