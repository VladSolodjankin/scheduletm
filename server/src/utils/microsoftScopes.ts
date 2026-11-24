/** Fixed on purpose (no env override): offline access for refresh tokens, calendar read/write, basic profile. */
export const MICROSOFT_OAUTH_SCOPES = 'offline_access Calendars.ReadWrite User.Read';

const GRAPH_SCOPE_PREFIX = 'https://graph.microsoft.com/';

/** Microsoft may return scopes bare ("Calendars.ReadWrite") or as Graph URIs; compare case-insensitively on the bare name. */
export function parseMicrosoftScopes(scopes: string | null | undefined): string[] {
  return (scopes ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((scope) => (scope.toLowerCase().startsWith(GRAPH_SCOPE_PREFIX) ? scope.slice(GRAPH_SCOPE_PREFIX.length) : scope).toLowerCase());
}

/** True when the granted scope set allows creating/updating/deleting events. */
export function hasMicrosoftCalendarWriteScope(scopes: string | null | undefined): boolean {
  return parseMicrosoftScopes(scopes).includes('calendars.readwrite');
}
