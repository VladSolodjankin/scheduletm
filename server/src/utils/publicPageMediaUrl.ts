import { env } from '../config/env.js';

export function publicPageMediaUrl(id: string): string {
  // Use whatever scheme API_BASE_URL is actually configured with — forcing
  // https unconditionally produced URLs the server can't serve (ERR_SSL_
  // PROTOCOL_ERROR) whenever the API runs over plain HTTP, e.g. local dev.
  return new URL(`/api/public-pages/media/${id}/content`, env.API_BASE_URL).toString();
}
