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

// Every environment (local dev, CI, and both the "dev" and "production" Railway services)
// resolves migrations the same way: TypeScript source under src/, interpreted directly via
// ts-node — no compiled dist/*.js copy, no build step before migrating. This is the single
// canonical representation migration rows get recorded under everywhere, so dev and prod
// knex_migrations history can never diverge by extension/directory again.
const runtimeMigrations: Knex.Config['migrations'] = {
  directory: './src/db/migrations',
  extension: 'ts',
};

const developmentConfig: Knex.Config = {
  client: 'pg',
  connection: resolveConnectionString('development'),
  migrations: runtimeMigrations,
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
  production: {
    client: 'pg',
    connection: resolveConnectionString('production'),
    migrations: runtimeMigrations,
    pool: {
      min: 0,
      max: 7,
    },
    acquireConnectionTimeout: 10_000,
  },
};

export default config;
