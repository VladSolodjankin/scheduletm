import crypto from 'node:crypto';
import { env } from '../config/env';

function decryptText(value: string, secret: string): string | null {
  const parts = value.split(':');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
      return null;
    }

    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function decryptIntegrationSecret(
  encryptedValue: string | null | undefined,
  plaintextFallback: string | null | undefined,
  secretName: string,
): string | null {
  if (encryptedValue === null || encryptedValue === undefined) {
    return plaintextFallback ?? null;
  }

  if (!env.appEncryptionKey) {
    throw new Error(`APP_ENCRYPTION_KEY is required to read encrypted ${secretName}`);
  }

  const decrypted = decryptText(encryptedValue, env.appEncryptionKey);
  if (decrypted === null) {
    throw new Error(`Unable to decrypt encrypted ${secretName}`);
  }

  return decrypted;
}
