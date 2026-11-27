import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const settings = vi.hoisted(() => ({
  canManageSpecialistBookingPolicies: vi.fn((role: string) => role !== 'client'),
  createScheduleExceptionForActor: vi.fn(),
  getAccountNotificationDefaults: vi.fn(),
  getAccountSettings: vi.fn(),
  getSpecialistBookingPolicy: vi.fn(),
  getSpecialistNotificationSettings: vi.fn(),
  getUserSettings: vi.fn(),
  listScheduleExceptionsForActor: vi.fn(),
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
  nameAgentChanges,
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

  it('lets owners change work days through account settings, but not specialists', async () => {
    settings.getAccountSettings.mockResolvedValue({ workDays: [1, 2, 3, 4, 5, 6] });
    settings.updateAccountSettings.mockResolvedValue({ workDays: [1, 2, 3, 4, 5] });
    const change = await validateAgentChange(owner, { resource: 'account_settings', operation: 'update', data: { workDays: [5, 4, 3, 2, 1] } });
    expect(change.before).toEqual({ workDays: [1, 2, 3, 4, 5, 6] });
    await applyAgentChange(owner, change);
    expect(settings.updateAccountSettings).toHaveBeenCalledWith(owner, { workDays: [5, 4, 3, 2, 1] });
    await expect(validateAgentChange(owner, { resource: 'account_settings', operation: 'update', data: { workDays: [1, 1] } }))
      .rejects.toMatchObject({ code: 'invalid_data' });
    await expect(validateAgentChange(specialist, { resource: 'account_settings', operation: 'update', data: { workDays: [1] } }))
      .rejects.toMatchObject({ code: 'unknown_resource' });
  });

  it('rejects working hours that end before they start', async () => {
    await expect(validateAgentChange(owner, { resource: 'specialists', operation: 'update', id: 3, data: { workStartHour: 18, workEndHour: 9 } }))
      .rejects.toMatchObject({ code: 'invalid_data' });
  });

  it('adds days off for one specialist through the existing schedule service', async () => {
    const catalog = buildAgentCatalog(owner).schedule_exceptions as { operations: string[] };
    expect(catalog.operations).toEqual(['read', 'create']);
    expect(buildAgentCatalog(specialist)).toHaveProperty('schedule_exceptions');

    settings.createScheduleExceptionForActor.mockResolvedValue({ id: 1 });
    await applyAgentChange(owner, {
      resource: 'schedule_exceptions', operation: 'create', data: { specialistId: 3, date: '2027-01-07', type: 'day_off', note: 'Рождество' },
    });
    expect(settings.createScheduleExceptionForActor).toHaveBeenCalledWith(owner, 3, { date: '2027-01-07', type: 'day_off', note: 'Рождество' });

    await applyAgentChange(owner, {
      resource: 'schedule_exceptions', operation: 'create', data: { date: '2027-01-08', type: 'break', startsAtMinute: 780, endsAtMinute: 840 },
    });
    expect(settings.createScheduleExceptionForActor).toHaveBeenLastCalledWith(
      owner, undefined, { date: '2027-01-08', type: 'break', startsAtMinute: 780, endsAtMinute: 840 },
    );

    for (const data of [
      { date: '07.01.2027', type: 'day_off' },
      { date: '2027-01-07', type: 'day_off', startsAtMinute: 600, endsAtMinute: 700 },
      { date: '2027-01-07', type: 'break' },
    ]) {
      await expect(validateAgentChange(owner, { resource: 'schedule_exceptions', operation: 'create', data }))
        .rejects.toMatchObject({ code: 'invalid_data' });
    }
    settings.createScheduleExceptionForActor.mockResolvedValue(null);
    await expect(applyAgentChange(owner, {
      resource: 'schedule_exceptions', operation: 'create', data: { specialistId: 99, date: '2027-01-07', type: 'vacation' },
    })).rejects.toMatchObject({ code: 'rejected' });
  });

  it('names specialists and services in proposed changes', async () => {
    services.getServicesForActor.mockResolvedValue({
      services: [{ id: 5, name: 'Стрижка' }],
      specialists: [{ id: 1, name: 'Анна', isActive: true }],
    });
    const named = await nameAgentChanges(owner, [
      { resource: 'booking_policy', operation: 'update', id: 1, data: { cancelGracePeriodHours: 24 } },
      { resource: 'service_prices', operation: 'update', id: 5, data: { specialistId: 1, changes: {} } },
      { resource: 'schedule_exceptions', operation: 'create', data: { specialistId: 99, date: '2027-01-01', type: 'day_off' } },
    ]);
    expect(named.map((change) => change.names)).toEqual([{ id: 'Анна' }, { id: 'Стрижка', specialistId: 'Анна' }, undefined]);

    services.getServicesForActor.mockRejectedValue(new Error('FORBIDDEN'));
    const plain = [{ resource: 'specialists', operation: 'update' as const, id: 1, data: {} }];
    expect(await nameAgentChanges(owner, plain)).toEqual(plain);
  });

  it('reads only upcoming days off', async () => {
    settings.listScheduleExceptionsForActor.mockResolvedValue([
      { id: 1, date: '2020-01-01', type: 'day_off' },
      { id: 2, date: '2999-01-01', type: 'vacation' },
    ]);
    expect(await readAgentResource(owner, 'schedule_exceptions', 3)).toEqual({ upcoming: [{ id: 2, date: '2999-01-01', type: 'vacation' }] });
    expect(settings.listScheduleExceptionsForActor).toHaveBeenCalledWith(owner, 3);
    settings.listScheduleExceptionsForActor.mockResolvedValue(null);
    await expect(readAgentResource(owner, 'schedule_exceptions')).rejects.toMatchObject({ code: 'rejected' });
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
