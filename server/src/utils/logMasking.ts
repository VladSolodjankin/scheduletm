const SENSITIVE_SEGMENTS: Array<[RegExp, string]> = [
  // Per-account webhook tokens (YooKassa / BOG) and client payment-link tokens must never reach the logs.
  [/^(\/api\/integrations\/(?:yookassa\/webhook|bog\/callback)\/)[^/]+/, '$1:token'],
  [/^(\/api\/public\/payments\/)[^/]+/, '$1:token'],
];

export function maskSensitivePath(pathname: string): string {
  return SENSITIVE_SEGMENTS.reduce((path, [pattern, replacement]) => path.replace(pattern, replacement), pathname);
}
