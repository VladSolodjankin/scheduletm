import { describe, expect, it } from 'vitest';
import {
  canCreateUserRole,
  canManageSpecialistSettings,
  canManageSystemSettings,
  canReadAccountMedia,
} from '../src/policies/rolePermissions.js';
import { WebUserRole } from '../src/types/webUserRole.js';

describe('role permissions', () => {
  it('allows owner/specialist to manage specialist settings', () => {
    expect(canManageSpecialistSettings(WebUserRole.ProductAdmin)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Owner)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Specialist)).toBe(true);
    expect(canManageSpecialistSettings(WebUserRole.Client)).toBe(false);
  });

  it('reserves system settings for product admins', () => {
    expect(canManageSystemSettings(WebUserRole.ProductAdmin)).toBe(true);
    expect(canManageSystemSettings(WebUserRole.Owner)).toBe(false);
  });

  it('allows account media reads only to managers and specialists', () => {
    expect(canReadAccountMedia(WebUserRole.ProductAdmin)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Owner)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Specialist)).toBe(true);
    expect(canReadAccountMedia(WebUserRole.Client)).toBe(false);
  });

  it('does not allow protected roles through managed-user creation', () => {
    expect(canCreateUserRole(WebUserRole.ProductAdmin, WebUserRole.ProductAdmin)).toBe(false);
    expect(canCreateUserRole(WebUserRole.ProductAdmin, WebUserRole.Owner)).toBe(false);
    expect(canCreateUserRole(WebUserRole.Owner, WebUserRole.Specialist)).toBe(true);
    expect(canCreateUserRole(WebUserRole.Owner, WebUserRole.Client)).toBe(true);
  });
});
