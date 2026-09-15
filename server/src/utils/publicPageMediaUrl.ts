import { env } from '../config/env.js';

export function publicPageMediaUrl(id: string): string {
  const url = new URL(`/api/public-pages/media/${id}/content`, env.API_BASE_URL);
  url.protocol = 'https:';
  return url.toString();
}
