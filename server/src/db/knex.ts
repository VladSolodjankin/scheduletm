import pg from 'pg';
import knex, { type Knex } from 'knex';
import { knexConfig } from './config.js';

// DATE (OID 1082): keep as the raw 'YYYY-MM-DD' string instead of node-postgres's default
// local-midnight Date object, which drifts to a different calendar date once serialized
// through Date#toISOString() (used by Express res.json()) on any non-UTC server.
pg.types.setTypeParser(1082, (value: string) => value);

const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export const db: Knex = knex(knexConfig[currentEnv]);
