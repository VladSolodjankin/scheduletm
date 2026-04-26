import { describe, expect, it } from 'vitest';
import { canManageSpecialistSettings } from '../src/policies/rolePermissions.js';
import { WebUserRole } from '../src/types/webUserRole.js';

describe('role permissions', () => {
  it('allows owner/admin/specialist to manage specialist settings', () => {
    expect(canManageSpecialistSettings(WebUserRole.Owner)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Admin)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Specialist)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Client)).toBe(false);
  });
});
