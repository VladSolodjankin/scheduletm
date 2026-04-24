import { describe, expect, it } from 'vitest';
import { specialistCreateSchema, specialistUpdateSchema } from '../src/config/schemas.js';

describe('specialist schemas unit', () => {
  it('validates create payload', () => {
    const parsed = specialistCreateSchema.safeParse({ name: 'Anna Specialist' });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty update payload', () => {
    const parsed = specialistUpdateSchema.safeParse({});

    expect(parsed.success).toBe(false);
  });
});
