import { env } from '../config/env.js';

const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_FULL_SCOPE = 'https://www.googleapis.com/auth/calendar';

export function parseGoogleScopes(scopes: string | null | undefined): string[] {
  return (scopes ?? '').split(/\s+/).filter(Boolean);
}

/** True when the granted scope set allows writing events (configured write scope, calendar.events or calendar). */
export function hasGoogleCalendarWriteScope(scopes: string | null | undefined): boolean {
  const granted = new Set(parseGoogleScopes(scopes));
  return [env.GOOGLE_OAUTH_WRITE_SCOPE, CALENDAR_EVENTS_SCOPE, CALENDAR_FULL_SCOPE]
    .filter(Boolean)
    .some((scope) => granted.has(scope));
}
