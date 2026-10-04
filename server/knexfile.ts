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
  // DATABASE_URL and DATABASE_PUBLIC_URL point at the same Postgres instance (internal vs.
  // public Railway address), so production must record migrations under the same
  // directory/extension as development — otherwise rows written by one env's filenames
  // (.ts) don't match the other's (.js) and knex reports the whole history as "missing".
  production: {
    client: 'pg',
    connection: resolveConnectionString('production'),
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
    },
    pool: {
      min: 0,
      max: 7,
    },
    acquireConnectionTimeout: 10_000,
  },
};

export default config;
