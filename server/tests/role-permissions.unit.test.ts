import { describe, expect, it } from 'vitest';
import {
  canCreateUserRole,
  canManageSpecialistSettings,
  canManageSystemSettings,
  canReadAccountMedia,
} from '../src/policies/rolePermissions.js';
import { WebUserRole } from '../src/types/webUserRole.js';

describe('role permissions', () => {
  it('allows owner/admin/specialist to manage specialist settings', () => {
    expect(canManageSpecialistSettings(WebUserRole.ProductOwner)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Owner)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Admin)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Specialist)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Client)).toBe(false);
  });

  it('reserves system settings for product owners', () => {
    expect(canManageSystemSettings(WebUserRole.ProductOwner)).toBe(true);
    expect(canManageSystemSettings(WebUserRole.Owner)).toBe(false);
    expect(canManageSystemSettings(WebUserRole.Admin)).toBe(false);
  });

  it('allows account media reads only to managers and specialists', () => {
    expect(canReadAccountMedia(WebUserRole.ProductOwner)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Owner)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Admin)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Specialist)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Client)).toBe(false);
  });

  it('does not allow protected roles through managed-user creation', () => {
    expect(canCreateUserRole(WebUserRole.ProductOwner, WebUserRole.ProductOwner)).toBe(false);
    expect(canCreateUserRole(WebUserRole.ProductOwner, WebUserRole.Owner)).toBe(false);
    expect(canCreateUserRole(WebUserRole.Owner, WebUserRole.Admin)).toBe(true);
    expect(canCreateUserRole(WebUserRole.Owner, WebUserRole.Specialist)).toBe(true);
    expect(canCreateUserRole(WebUserRole.Owner, WebUserRole.Client)).toBe(true);
  });
});
