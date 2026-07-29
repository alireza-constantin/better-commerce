export type RuntimeEnvironment = 'development' | 'test' | 'production';
export type DatabaseSslMode = 'disable' | 'require' | 'verify-full';

export interface DatabaseConfiguration {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  sslMode: DatabaseSslMode;
  poolMax: number;
  connectionTimeoutMs: number;
  statementTimeoutMs: number;
}

export interface SessionConfiguration {
  secrets: string[];
  idleTtlMs: number;
  absoluteTtlMs: number;
  cookieName: string;
}

export interface RedisConfiguration {
  url: string;
  connectTimeoutMs: number;
}

export interface ObjectStorageConfiguration {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

export interface ApplicationConfiguration {
  environment: RuntimeEnvironment;
  port: number;
  trustProxyHops: number;
  publicRegistration: boolean;
  requireEmailVerification: boolean;
  commerce: {
    currency: string;
    manualReviewHoldMinutes: number;
    reservationSweepIntervalSeconds: number;
    reservationSweepBatchSize: number;
  };
  cart: {
    anonymousTtlMs: number;
    customerTtlMs: number;
    claimReplayTtlMs: number;
  };
  database: DatabaseConfiguration;
  redis: RedisConfiguration;
  session: SessionConfiguration;
  objectStorage: ObjectStorageConfiguration;
}

type EnvironmentSource = Record<string, unknown>;

const readString = (
  source: EnvironmentSource,
  key: string,
  options: { defaultValue?: string; allowEmpty?: boolean } = {},
): string => {
  const rawValue = source[key] ?? options.defaultValue;

  if (typeof rawValue !== 'string') {
    throw new Error(`${key} must be a string`);
  }

  const value = rawValue.trim();
  if (!options.allowEmpty && value.length === 0) {
    throw new Error(`${key} must not be empty`);
  }

  return value;
};

const readInteger = (
  source: EnvironmentSource,
  key: string,
  defaultValue: number,
  range: { min: number; max: number },
): number => {
  const rawValue = source[key] ?? String(defaultValue);
  if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    throw new Error(`${key} must be an integer`);
  }

  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);

  if (!Number.isSafeInteger(value) || value < range.min || value > range.max) {
    throw new Error(
      `${key} must be an integer between ${range.min} and ${range.max}`,
    );
  }

  return value;
};

const readBoolean = (
  source: EnvironmentSource,
  key: string,
  defaultValue: boolean,
): boolean => {
  const rawValue = source[key];
  if (rawValue === undefined) {
    return defaultValue;
  }

  if (rawValue === true || rawValue === 'true') {
    return true;
  }

  if (rawValue === false || rawValue === 'false') {
    return false;
  }

  throw new Error(`${key} must be either true or false`);
};

const readEnvironment = (source: EnvironmentSource): RuntimeEnvironment => {
  const environment = readString(source, 'NODE_ENV', {
    defaultValue: 'development',
  });

  if (!['development', 'test', 'production'].includes(environment)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  return environment as RuntimeEnvironment;
};

const readSslMode = (
  source: EnvironmentSource,
  environment: RuntimeEnvironment,
): DatabaseSslMode => {
  const sslMode = readString(source, 'DB_SSL_MODE', {
    defaultValue: environment === 'production' ? 'verify-full' : 'disable',
  });

  if (!['disable', 'require', 'verify-full'].includes(sslMode)) {
    throw new Error('DB_SSL_MODE must be disable, require, or verify-full');
  }

  return sslMode as DatabaseSslMode;
};

const readRedisUrl = (source: EnvironmentSource): string => {
  const redisUrl = readString(source, 'REDIS_URL');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid URL');
  }

  if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
    throw new Error('REDIS_URL must use the redis or rediss protocol');
  }

  return redisUrl;
};

const readSessionSecrets = (source: EnvironmentSource): string[] => {
  const secrets = readString(source, 'SESSION_SECRETS')
    .split(',')
    .map((secret) => secret.trim());

  if (secrets.some((secret) => secret.length < 32)) {
    throw new Error(
      'Every SESSION_SECRETS entry must be at least 32 characters',
    );
  }

  if (new Set(secrets).size !== secrets.length) {
    throw new Error('SESSION_SECRETS must not contain duplicate values');
  }

  return secrets;
};

export const buildConfiguration = (
  source: EnvironmentSource,
): ApplicationConfiguration => {
  const environment = readEnvironment(source);
  const publicRegistration = readBoolean(source, 'PUBLIC_REGISTRATION', true);
  const requireEmailVerification = readBoolean(
    source,
    'REQUIRE_EMAIL_VERIFICATION',
    false,
  );

  if (
    environment === 'production' &&
    publicRegistration &&
    !requireEmailVerification
  ) {
    throw new Error(
      'Production public registration requires email verification to be enabled',
    );
  }

  const idleTtlSeconds = readInteger(
    source,
    'SESSION_IDLE_SECONDS',
    7 * 24 * 60 * 60,
    { min: 5 * 60, max: 30 * 24 * 60 * 60 },
  );
  const absoluteTtlSeconds = readInteger(
    source,
    'SESSION_ABSOLUTE_SECONDS',
    30 * 24 * 60 * 60,
    { min: 5 * 60, max: 90 * 24 * 60 * 60 },
  );

  if (absoluteTtlSeconds < idleTtlSeconds) {
    throw new Error(
      'SESSION_ABSOLUTE_SECONDS must be greater than or equal to SESSION_IDLE_SECONDS',
    );
  }

  return {
    environment,
    port: readInteger(source, 'PORT', 3000, { min: 1, max: 65_535 }),
    trustProxyHops: readInteger(
      source,
      'TRUST_PROXY_HOPS',
      environment === 'production' ? 1 : 0,
      { min: 0, max: 5 },
    ),
    publicRegistration,
    requireEmailVerification,
    commerce: {
      currency: readString(source, 'STORE_CURRENCY', {
        defaultValue: 'USD',
      }).toUpperCase(),
      manualReviewHoldMinutes: readInteger(
        source,
        'MANUAL_ORDER_HOLD_MINUTES',
        720,
        { min: 30, max: 1_440 },
      ),
      reservationSweepIntervalSeconds: readInteger(
        source,
        'RESERVATION_SWEEP_INTERVAL_SECONDS',
        60,
        { min: 5, max: 3_600 },
      ),
      reservationSweepBatchSize: readInteger(
        source,
        'RESERVATION_SWEEP_BATCH_SIZE',
        100,
        { min: 1, max: 1_000 },
      ),
    },
    cart: {
      anonymousTtlMs:
        readInteger(source, 'CART_ANONYMOUS_TTL_SECONDS', 30 * 24 * 60 * 60, {
          min: 24 * 60 * 60,
          max: 365 * 24 * 60 * 60,
        }) * 1_000,
      customerTtlMs:
        readInteger(source, 'CART_CUSTOMER_TTL_SECONDS', 90 * 24 * 60 * 60, {
          min: 24 * 60 * 60,
          max: 365 * 24 * 60 * 60,
        }) * 1_000,
      claimReplayTtlMs:
        readInteger(source, 'CART_CLAIM_REPLAY_TTL_SECONDS', 24 * 60 * 60, {
          min: 60 * 60,
          max: 7 * 24 * 60 * 60,
        }) * 1_000,
    },
    database: {
      host: readString(source, 'DB_HOST'),
      port: readInteger(source, 'DB_PORT', 5432, { min: 1, max: 65_535 }),
      username: readString(source, 'DB_USER'),
      password: readString(source, 'DB_PASSWORD'),
      name: readString(source, 'DB_NAME'),
      sslMode: readSslMode(source, environment),
      poolMax: readInteger(source, 'DB_POOL_MAX', 10, { min: 1, max: 100 }),
      connectionTimeoutMs: readInteger(
        source,
        'DB_CONNECTION_TIMEOUT_MS',
        5_000,
        { min: 100, max: 60_000 },
      ),
      statementTimeoutMs: readInteger(
        source,
        'DB_STATEMENT_TIMEOUT_MS',
        10_000,
        { min: 100, max: 120_000 },
      ),
    },
    redis: {
      url: readRedisUrl(source),
      connectTimeoutMs: readInteger(source, 'REDIS_CONNECT_TIMEOUT_MS', 5_000, {
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
      }),
    },
    session: {
      secrets: readSessionSecrets(source),
      idleTtlMs: idleTtlSeconds * 1_000,
      absoluteTtlMs: absoluteTtlSeconds * 1_000,
      cookieName: '__Host-bc.sid',
    },
    objectStorage: {
      endpoint: readString(source, 'OBJECT_STORAGE_ENDPOINT', {
        defaultValue:
          environment === 'production' ? undefined : 'http://localhost:9000',
      }),
      region: readString(source, 'OBJECT_STORAGE_REGION', {
        defaultValue: 'us-east-1',
      }),
      bucket: readString(source, 'OBJECT_STORAGE_BUCKET', {
        defaultValue:
          environment === 'production' ? undefined : 'better-commerce',
      }),
      accessKeyId: readString(source, 'OBJECT_STORAGE_ACCESS_KEY_ID', {
        defaultValue:
          environment === 'production' ? undefined : 'better-commerce-dev',
      }),
      secretAccessKey: readString(source, 'OBJECT_STORAGE_SECRET_ACCESS_KEY', {
        defaultValue:
          environment === 'production'
            ? undefined
            : 'better-commerce-development-only',
      }),
      publicBaseUrl: readString(source, 'OBJECT_STORAGE_PUBLIC_BASE_URL', {
        defaultValue:
          environment === 'production'
            ? undefined
            : 'http://localhost:9000/better-commerce',
      }),
      forcePathStyle: readBoolean(
        source,
        'OBJECT_STORAGE_FORCE_PATH_STYLE',
        true,
      ),
    },
  };
};

/** Factory consumed by ConfigModule.load. */
export const configuration = (): ApplicationConfiguration =>
  buildConfiguration(process.env);

/** Fail-fast validation hook consumed by ConfigModule.forRoot. */
export const validateEnvironment = (
  source: EnvironmentSource,
): EnvironmentSource => {
  buildConfiguration(source);
  return source;
};
