import crypto from 'node:crypto';

export const sanitizeEmail = (email: string) => email.trim().toLowerCase();

export const hashPassword = (password: string, salt: string) =>
  crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');

export const createToken = () => crypto.randomBytes(32).toString('hex');

export const verifyPassword = (password: string, salt: string, hash: string) =>
  crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt), 'hex'), Buffer.from(hash, 'hex'));
