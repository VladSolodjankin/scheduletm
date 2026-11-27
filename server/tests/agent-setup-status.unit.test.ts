import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const data = vi.hoisted(() => ({
  listServices: vi.fn(),
  listAssignments: vi.fn(),
  findSpecialistForUser: vi.fn(),
  countSpecialistsByAccount: vi.fn(),
  findAccountSettingsByAccountId: vi.fn(),
  hasPublishedPublicPage: vi.fn(),
  hasAnyAppointment: vi.fn(),
  getTelegramBotSettings: vi.fn(),
  getPaymentSettings: vi.fn(),
  getUserSettings: vi.fn(),
}));
vi.mock('../src/repositories/serviceRepository.js', () => ({
  listServices: data.listServices, listAssignments: data.listAssignments, findSpecialistForUser: data.findSpecialistForUser,
}));
vi.mock('../src/repositories/specialistRepository.js', () => ({ countSpecialistsByAccount: data.countSpecialistsByAccount }));
vi.mock('../src/repositories/accountSettingsRepository.js', () => ({ findAccountSettingsByAccountId: data.findAccountSettingsByAccountId }));
vi.mock('../src/repositories/publicPageRepository.js', () => ({ hasPublishedPublicPage: data.hasPublishedPublicPage }));
vi.mock('../src/repositories/appointmentRepository.js', () => ({ hasAnyAppointment: data.hasAnyAppointment }));
vi.mock('../src/services/telegramBotSettingsService.js', () => ({ getTelegramBotSettings: data.getTelegramBotSettings }));
vi.mock('../src/services/paymentSettingsService.js', () => ({ getPaymentSettings: data.getPaymentSettings }));
vi.mock('../src/services/settingsService.js', () => ({
  getUserSettings: data.getUserSettings,
  canManageSpecialistBookingPolicies: (role: WebUserRole) => role !== WebUserRole.Client,
}));

import { computeSetupStatus } from '../src/services/agent/agentSetupStatus.js';

const owner = { id: '7', accountId: 2, email: '', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const specialist = { ...owner, id: '9', role: WebUserRole.Specialist };
const service = (id: number, isActive = true) => ({ id, is_active: isActive });
const calendars = { googleConnected: false, microsoftConnected: false, appleCalendarFeedEnabled: false };

describe('agent setup status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.listServices.mockResolvedValue([service(1), service(2), service(3, false)]);
    data.listAssignments.mockResolvedValue([{ serviceId: 1, isActive: true }, { serviceId: 2, isActive: false }]);
    data.countSpecialistsByAccount.mockResolvedValue(1);
    data.findAccountSettingsByAccountId.mockResolvedValue({ business_address: 'Tbilisi, Rustaveli 1' });
    data.hasPublishedPublicPage.mockResolvedValue(false);
    data.hasAnyAppointment.mockResolvedValue(true);
    data.getTelegramBotSettings.mockResolvedValue({ enabled: true });
    data.getPaymentSettings.mockResolvedValue({ hasAnyMethod: false });
    data.getUserSettings.mockResolvedValue({ ...calendars, appleCalendarFeedEnabled: true });
  });

  it('reports account-wide steps for owners, scoped to their account', async () => {
    const status = await computeSetupStatus(owner);
    expect(status.steps).toEqual([
      { key: 'services', done: true, optional: false, path: '/services' },
      { key: 'service_assignments', done: false, optional: false, path: '/services' },
      { key: 'team', done: false, optional: true, path: '/specialists' },
      { key: 'business_address', done: true, optional: false, path: '/settings/account' },
      { key: 'public_page', done: false, optional: false, path: '/public-pages' },
      { key: 'telegram_bot', done: true, optional: false, path: '/telegram-bot' },
      { key: 'payments', done: false, optional: true, path: '/payments' },
      { key: 'calendar', done: true, optional: true, path: '/settings/integrations' },
      { key: 'test_booking', done: true, optional: false, path: null },
    ]);
    expect(status.remaining).toBe(2);
    // Only active services are checked for a provider, in one query.
    expect(data.listAssignments).toHaveBeenCalledTimes(1);
    expect(data.listAssignments).toHaveBeenCalledWith(2, [1, 2]);
    for (const fn of [data.listServices, data.countSpecialistsByAccount, data.findAccountSettingsByAccountId,
      data.hasPublishedPublicPage, data.hasAnyAppointment, data.getTelegramBotSettings, data.getPaymentSettings]) {
      expect(fn.mock.calls[0]![0]).toBe(2);
    }
  });

  it('shows a specialist only their own steps', async () => {
    data.findSpecialistForUser.mockResolvedValue({ id: 4 });
    data.listServices.mockImplementation(async (_accountId: number, specialistId?: number) => (specialistId ? [] : [service(1)]));
    data.getUserSettings.mockResolvedValue(calendars);
    const status = await computeSetupStatus(specialist);
    expect(status).toEqual({
      steps: [
        { key: 'services', done: true, optional: false, path: '/services' },
        { key: 'service_assignments', done: false, optional: false, path: '/services' },
        { key: 'calendar', done: false, optional: true, path: '/settings/integrations' },
      ],
      remaining: 1,
    });
    expect(data.findSpecialistForUser).toHaveBeenCalledWith(2, 9);
    expect(data.listServices).toHaveBeenCalledWith(2, 4);
    expect(data.getTelegramBotSettings).not.toHaveBeenCalled();
    expect(data.getPaymentSettings).not.toHaveBeenCalled();
  });
});
