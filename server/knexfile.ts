import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_PUBLIC_URL,
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
    },
    pool: {
      min: 0,
      max: 7,
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './dist/db/migrations',
      extension: 'js',
    },
    pool: {
      min: 0,
      max: 7,
    },
  },
};

export default config;
