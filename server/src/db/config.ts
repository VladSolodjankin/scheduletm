import type { Knex } from 'knex';

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

export const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: resolveConnectionString('development'),
    pool: {
      min: 0,
      max: 7,
    },
    acquireConnectionTimeout: 10_000,
  },
  production: {
    client: 'pg',
    connection: resolveConnectionString('production'),
    pool: {
      min: 0,
      max: 7,
    },
    acquireConnectionTimeout: 10_000,
  },
};
