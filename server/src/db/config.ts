import type { Knex } from 'knex';

export const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_PUBLIC_URL,
    pool: {
      min: 0,
      max: 7,
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 0,
      max: 7,
    },
  },
};
