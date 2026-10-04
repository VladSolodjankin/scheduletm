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

// Every environment that actually RUNS migrations (local dev, CI, both the "dev" and
// "production" Railway services — Railway sets NODE_ENV=production on every service
// regardless of which database it points at) must resolve migrations the same way:
// against the compiled ./dist/db/migrations/*.js output. If dev and prod ever disagree
// on directory/extension here, each database's knex_migrations history silently diverges
// (rows get recorded under whichever name was active when they were applied) and a later
// "corrupt migration directory" error becomes unavoidable. `npm run migrate:latest`/
// `migrate:rollback` rebuild dist first (see package.json), so this is always fresh.
const runtimeMigrations: Knex.Config['migrations'] = {
  directory: './dist/db/migrations',
  extension: 'js',
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
  // Only `migrate:make` (authoring a new migration) targets this: new migrations are always
  // written as TypeScript source under src/, then compiled to dist/ like the rest of the app.
  // Selected explicitly via `--env make`, never by NODE_ENV, so it can't be picked up by
  // migrate:latest/rollback by accident.
  make: {
    client: 'pg',
    connection: resolveConnectionString('development'),
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
    },
  },
};

export default config;
