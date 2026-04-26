import { describe, expect, it } from 'vitest';
import { specialistBookingPolicySchema } from '../src/config/schemas.js';
import { canManageSpecialistBookingPolicies } from '../src/services/settingsService.js';
import { WebUserRole } from '../src/types/webUserRole.js';

describe('specialist booking policy unit', () => {
  it('allows valid specialist booking policy payload', () => {
    const parsed = specialistBookingPolicySchema.safeParse({
      cancelGracePeriodHours: 24,
      refundOnLateCancel: false,
      autoCancelUnpaidEnabled: true,
      unpaidAutoCancelAfterHours: 72,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects out-of-range specialist booking policy values', () => {
    const parsed = specialistBookingPolicySchema.safeParse({
      cancelGracePeriodHours: 999,
      refundOnLateCancel: false,
      autoCancelUnpaidEnabled: true,
      unpaidAutoCancelAfterHours: 0,
    });

    expect(parsed.success).toBe(false);
  });

  it('grants specialist booking policy access only to owner/admin/specialist', () => {
    expect(canManageSpecialistBookingPolicies(WebUserRole.Owner)).toBe(true);
    expect(canManageSpecialistBookingPolicies(WebUserRole.Admin)).toBe(true);
    expect(canManageSpecialistBookingPolicies(WebUserRole.Specialist)).toBe(true);
    expect(canManageSpecialistBookingPolicies(WebUserRole.Client)).toBe(false);
  });
});
