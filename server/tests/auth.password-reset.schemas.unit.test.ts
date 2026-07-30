import { describe, expect, it } from 'vitest';
import { passwordResetConfirmSchema, passwordResetRequestSchema } from '../src/config/schemas.js';

describe('password reset schemas', () => {
  it('accepts a valid request email', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'owner@example.com' }).success).toBe(true);
  });

  it('requires a four-digit code and the existing strong password contract', () => {
    expect(passwordResetConfirmSchema.safeParse({
      email: 'owner@example.com',
      code: '1234',
      password: 'SecurePass1',
    }).success).toBe(true);
    expect(passwordResetConfirmSchema.safeParse({
      email: 'owner@example.com',
      code: '12345',
      password: 'SecurePass1',
    }).success).toBe(false);
    expect(passwordResetConfirmSchema.safeParse({
      email: 'owner@example.com',
      code: '1234',
      password: 'weak',
    }).success).toBe(false);
  });
});
