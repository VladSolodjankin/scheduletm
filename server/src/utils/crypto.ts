import crypto from 'node:crypto';

export const sanitizeEmail = (email: string) => email.trim().toLowerCase();

export const hashPassword = (password: string, salt: string) =>
  crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');

export const createToken = () => crypto.randomBytes(32).toString('hex');

export const verifyPassword = (password: string, salt: string, hash: string) =>
  crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt), 'hex'), Buffer.from(hash, 'hex'));

export const generateTemporaryPassword = (length = 14) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from(crypto.randomBytes(length), (value) => alphabet[value % alphabet.length]).join('');
};

function buildEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptText(value: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = buildEncryptionKey(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptText(value: string, secret: string): string | null {
  const parts = value.split(':');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const key = buildEncryptionKey(secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
