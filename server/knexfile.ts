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

const config: Record<string, Knex.Config> = {
  development: {
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
  },
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
