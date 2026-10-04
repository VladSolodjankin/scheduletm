import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const resolveConnectionString = (envName: 'development' | 'production'): string => {
  const primary = envName === 'production' ? process.env.DATABASE_URL : process.env.DATABASE_PUBLIC_URL;
  const fallback = envName === 'production' ? process.env.DATABASE_PUBLIC_URL : process.env.DATABASE_URL;
  const connection = primary ?? fallback;

  if (!connection) {
    throw new Error(
      `Не задана строка подключения к Postgres для окружения "${envName}". ` +
        'Укажите DATABASE_PUBLIC_URL или DATABASE_URL в server/.env.',
    );
  }

  return connection;
};

const developmentConfig: Knex.Config = {
  client: 'pg',
  connection: resolveConnectionString('development'),
  migrations: {
    directory: './src/db/migrations',
    extension: 'ts',
  },
  pool: {
    min: 0,
    max: 7,
  },
  acquireConnectionTimeout: 10_000,
};

const config: Record<string, Knex.Config> = {
  development: developmentConfig,
  // NODE_ENV=test (e.g. CI) has no dedicated settings of its own; reuse development's.
  test: developmentConfig,
  // Production has its own dedicated Postgres instance (separate from development's), so its
  // knex_migrations history is independent: it was built entirely from compiled .js files and
  // must keep using them. Do not "unify" this with developmentConfig — the two databases have
  // separate, unrelated migration histories, and pointing production at ./src (.ts) causes knex
  // to report every already-applied migration as missing (verified against the real prod table:
  // 78/78 rows recorded with a .js extension, batches 1-43).
  production: {
    client: 'pg',
    connection: resolveConnectionString('production'),
    migrations: {
      directory: './dist/db/migrations',
      extension: 'js',
    },
    pool: {
      min: 0,
      max: 7,
    },
    acquireConnectionTimeout: 10_000,
  },
};

export default config;
