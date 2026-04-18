import knex, { Knex } from 'knex';
import config from '../../knexfile';

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export const db: Knex = knex(config[env]);
