import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let client: Redis | null = null;
let initialized = false;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!initialized) {
    initialized = true;
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    client.on('error', (error) => {
      console.error('[redis] connection error', error);
    });
  }

  return client;
}
