import { describe, expect, it } from 'vitest';
import { specialistCreateSchema, specialistUpdateSchema } from '../src/config/schemas.js';

describe('specialist schemas unit', () => {
  it('validates create payload', () => {
    const parsed = specialistCreateSchema.safeParse({ userId: 12341234 });

    expect(parsed.success).toBe(true);
  });

  it('requires the working day to end after it starts', () => {
    expect(specialistUpdateSchema.safeParse({ workStartHour: 9, workEndHour: 18 }).success).toBe(true);
    expect(specialistUpdateSchema.safeParse({ workStartHour: 18, workEndHour: 18 }).success).toBe(false);
    expect(specialistUpdateSchema.safeParse({ workStartHour: 20, workEndHour: 9 }).success).toBe(false);
    expect(specialistUpdateSchema.safeParse({ workEndHour: 9 }).success).toBe(true);
  });

  it('rejects empty update payload', () => {
    const parsed = specialistUpdateSchema.safeParse({});

    expect(parsed.success).toBe(false);
  });
});
