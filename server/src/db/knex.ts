import knex, { type Knex } from 'knex';
import { knexConfig } from './config.js';

const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export const db: Knex = knex(knexConfig[currentEnv]);
