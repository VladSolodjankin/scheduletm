import { env } from '../config/env.js';
import { decryptText, encryptText } from '../utils/crypto.js';

function requireEncryptionKey(operation: 'read' | 'write', secretName: string): string {
  if (!env.APP_ENCRYPTION_KEY) {
    throw new Error(`APP_ENCRYPTION_KEY is required to ${operation} encrypted ${secretName}`);
  }

  return env.APP_ENCRYPTION_KEY;
}

export function encryptIntegrationSecret(value: string | null, secretName: string): string | null {
  if (value === null) {
    return null;
  }

  return encryptText(value, requireEncryptionKey('write', secretName));
}

export function decryptIntegrationSecret(
  encryptedValue: string | null | undefined,
  plaintextFallback: string | null | undefined,
  secretName: string,
): string | null {
  if (encryptedValue === null || encryptedValue === undefined) {
    return plaintextFallback ?? null;
  }

  const decrypted = decryptText(
    encryptedValue,
    requireEncryptionKey('read', secretName),
  );
  if (decrypted === null) {
    throw new Error(`Unable to decrypt encrypted ${secretName}`);
  }

  return decrypted;
}
