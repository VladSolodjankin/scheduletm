import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const settings = vi.hoisted(() => ({
  canManageSpecialistBookingPolicies: vi.fn((role: string) => role !== 'client'),
  getAccountNotificationDefaults: vi.fn(),
  getAccountSettings: vi.fn(),
  getSpecialistBookingPolicy: vi.fn(),
  getSpecialistNotificationSettings: vi.fn(),
  getUserSettings: vi.fn(),
  putAccountNotificationDefaults: vi.fn(),
  putSpecialistNotificationSettings: vi.fn(),
  updateAccountSettings: vi.fn(),
  updateSpecialistBookingPolicy: vi.fn(),
}));
const services = vi.hoisted(() => ({
  createServiceForActor: vi.fn(),
  getServicesForActor: vi.fn(),
  updateAssignmentForActor: vi.fn(),
  updateServiceForActor: vi.fn(),
}));
const specialists = vi.hoisted(() => ({
  createSpecialistForActor: vi.fn(),
  getAvailableSpecialistWebUsersForActor: vi.fn(),
  getSpecialistsForActor: vi.fn(),
  updateSpecialistForActor: vi.fn(),
}));
const users = vi.hoisted(() => ({ createManagedUser: vi.fn(), listManagedUsers: vi.fn() }));
const payments = vi.hoisted(() => ({ getPaymentSettings: vi.fn() }));
const bot = vi.hoisted(() => ({ getTelegramBotSettings: vi.fn() }));
vi.mock('../src/services/settingsService.js', () => settings);
vi.mock('../src/services/serviceService.js', () => services);
vi.mock('../src/services/specialistService.js', () => specialists);
vi.mock('../src/services/userManagementService.js', () => users);
vi.mock('../src/services/paymentSettingsService.js', () => payments);
vi.mock('../src/services/telegramBotSettingsService.js', () => bot);

import {
  AgentResourceError,
  applyAgentChange,
  buildAgentCatalog,
  readAgentResource,
  validateAgentChange,
} from '../src/services/agent/agentResources.js';

const owner = { id: '7', accountId: 2, email: '', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const specialist = { ...owner, role: WebUserRole.Specialist };
const client = { ...owner, role: WebUserRole.Client };

describe('agent resource registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.getServicesForActor.mockResolvedValue({
      services: [{ id: 4, name: 'Lashes', basePrice: 2000, baseDurationMinutes: 90, assignments: [] }],
      specialists: [],
    });
  });

  it('shows each role only the resources its services allow', () => {
    expect(Object.keys(buildAgentCatalog(owner))).toEqual(expect.arrayContaining([
      'account_settings', 'account_notification_defaults', 'specialists', 'specialist_invites', 'services', 'integrations',
    ]));
    const forSpecialist = Object.keys(buildAgentCatalog(specialist));
    expect(forSpecialist).not.toContain('account_settings');
    expect(forSpecialist).not.toContain('specialist_invites');
    expect(forSpecialist).toContain('booking_policy');
    expect(buildAgentCatalog(client)).toEqual({});
  });

  it('describes fields from the Zod schemas without exposing internal ones', () => {
    const services = buildAgentCatalog(owner).services as { createFields: { properties: Record<string, { description?: string }> } };
    expect(services.createFields.properties.basePrice?.description).toContain('whole currency units');
    expect(services.createFields.properties).not.toHaveProperty('imageMediaId');
  });

  it('rejects unknown resources, resources of other roles and missing operations', async () => {
    await expect(validateAgentChange(owner, { resource: 'users', operation: 'update', data: {} }))
      .rejects.toMatchObject({ code: 'unknown_resource' });
    await expect(validateAgentChange(specialist, { resource: 'account_settings', operation: 'update', data: { weekStartsOnMonday: true } }))
      .rejects.toMatchObject({ code: 'unknown_resource' });
    await expect(validateAgentChange(owner, { resource: 'integrations', operation: 'update', data: {} }))
      .rejects.toMatchObject({ code: 'operation_not_supported' });
  });

  it('validates data with the existing schemas and reports the failing fields', async () => {
    const error = await validateAgentChange(owner, { resource: 'services', operation: 'create', data: { name: 'Brows', basePrice: -5 } })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AgentResourceError);
    expect((error as AgentResourceError).code).toBe('invalid_data');
    expect((error as AgentResourceError).details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'basePrice' }),
      expect.objectContaining({ path: 'baseDurationMinutes' }),
    ]));
    await expect(validateAgentChange(owner, { resource: 'services', operation: 'update', data: { basePrice: 100 } }))
      .rejects.toMatchObject({ code: 'id_required' });
    await expect(validateAgentChange(owner, { resource: 'services', operation: 'update', id: 4, data: {} }))
      .rejects.toMatchObject({ code: 'invalid_data' });
  });

  it('adds the current values of updated fields for the confirmation card', async () => {
    const change = await validateAgentChange(owner, { resource: 'services', operation: 'update', id: 4, data: { basePrice: 2500 } });
    expect(change.before).toEqual({ basePrice: 2000 });
    expect(services.updateServiceForActor).not.toHaveBeenCalled();
  });

  it('applies changes only through the existing services with the signed-in user', async () => {
    services.createServiceForActor.mockResolvedValue({ id: 9 });
    await applyAgentChange(owner, {
      resource: 'services', operation: 'create', data: { name: 'Brows', basePrice: 1500, baseDurationMinutes: 60 },
    });
    expect(services.createServiceForActor).toHaveBeenCalledWith(owner, { name: 'Brows', basePrice: 1500, baseDurationMinutes: 60 });

    users.createManagedUser.mockResolvedValue({ id: 11 });
    await applyAgentChange(owner, {
      resource: 'specialist_invites', operation: 'create', data: { email: 'anna@test.dev', firstName: 'Anna', lastName: 'K', role: 'client' },
    });
    expect(users.createManagedUser).toHaveBeenCalledWith(owner, expect.objectContaining({ email: 'anna@test.dev', role: 'specialist' }));

    services.updateAssignmentForActor.mockResolvedValue({});
    await applyAgentChange(owner, {
      resource: 'service_prices', operation: 'update', id: 4, data: { specialistId: 3, changes: { priceOverride: 1800 } },
    });
    expect(services.updateAssignmentForActor).toHaveBeenCalledWith(owner, 4, 3, { priceOverride: 1800 });
  });

  it('turns a rejected service call into an error instead of a silent success', async () => {
    settings.updateAccountSettings.mockResolvedValue(null);
    settings.getAccountSettings.mockResolvedValue({ weekStartsOnMonday: false });
    await expect(applyAgentChange(owner, { resource: 'account_settings', operation: 'update', data: { weekStartsOnMonday: true } }))
      .rejects.toMatchObject({ code: 'rejected' });
  });

  it('hides payment details from specialists when reading integrations', async () => {
    settings.getUserSettings.mockResolvedValue({
      googleConnected: true, microsoftConnected: false, appleCalendarFeedEnabled: false, zoomConnected: false, yandexConnected: false,
    });
    bot.getTelegramBotSettings.mockResolvedValue({ enabled: true, mode: 'shared', botLink: 'https://t.me/x', slug: 'x', welcomeMessage: '' });
    const result = await readAgentResource(specialist, 'integrations') as { payments: unknown; calendars: { google: boolean } };
    expect(result.calendars.google).toBe(true);
    expect(result.payments).toBeNull();
    expect(payments.getPaymentSettings).not.toHaveBeenCalled();
  });
});
