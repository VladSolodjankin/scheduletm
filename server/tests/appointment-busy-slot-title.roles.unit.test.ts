import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { WebUserRole } from '../src/types/webUserRole.js';

const SECRET = 'Secret dentist visit';
const SPECIALIST_WEB_USER_ID = 10;

const mocks = vi.hoisted(() => ({
  listAppointmentsAllAccounts: vi.fn(),
  listAppointments: vi.fn(),
  listAppointmentEventsByAppointmentIds: vi.fn(),
  listSpecialistsAllAccounts: vi.fn(),
  listSpecialistsByAccount: vi.fn(),
  listClientsByAccount: vi.fn(),
  findWebUserById: vi.fn(),
  findSpecialistsCalendarCredentials: vi.fn(),
  findSpecialistByWebUserId: vi.fn(),
  findAccountSettingsByAccountId: vi.fn(),
}));

vi.mock('axios');

vi.mock('../src/repositories/appointmentRepository.js', async () => ({
  ...(await vi.importActual<typeof import('../src/repositories/appointmentRepository.js')>(
    '../src/repositories/appointmentRepository.js',
  )),
  listAppointmentsAllAccounts: mocks.listAppointmentsAllAccounts,
  listAppointments: mocks.listAppointments,
  listAppointmentEventsByAppointmentIds: mocks.listAppointmentEventsByAppointmentIds,
}));

vi.mock('../src/repositories/specialistRepository.js', async () => ({
  ...(await vi.importActual<typeof import('../src/repositories/specialistRepository.js')>(
    '../src/repositories/specialistRepository.js',
  )),
  listSpecialistsAllAccounts: mocks.listSpecialistsAllAccounts,
  listSpecialistsByAccount: mocks.listSpecialistsByAccount,
  findSpecialistsCalendarCredentials: mocks.findSpecialistsCalendarCredentials,
  findSpecialistByWebUserId: mocks.findSpecialistByWebUserId,
}));

vi.mock('../src/repositories/accountSettingsRepository.js', () => ({
  findAccountSettingsByAccountId: mocks.findAccountSettingsByAccountId,
}));

vi.mock('../src/repositories/clientRepository.js', async () => ({
  ...(await vi.importActual<typeof import('../src/repositories/clientRepository.js')>(
    '../src/repositories/clientRepository.js',
  )),
  listClientsByAccount: mocks.listClientsByAccount,
}));

vi.mock('../src/repositories/webUserRepository.js', async () => ({
  ...(await vi.importActual<typeof import('../src/repositories/webUserRepository.js')>(
    '../src/repositories/webUserRepository.js',
  )),
  findWebUserById: mocks.findWebUserById,
}));

const { getAppointments } = await import('../src/services/appointmentService.js');

const actor = (id: string, role: WebUserRole) => ({ id, accountId: 1, email: 'a@example.com', role }) as any;

describe('getAppointments busy slot titles by actor', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();

    const specialists = [{ id: 5, name: 'Spec', timezone: 'UTC', slot_step_min: 30, user_id: SPECIALIST_WEB_USER_ID }];
    mocks.listAppointmentsAllAccounts.mockResolvedValue([]);
    mocks.listAppointments.mockResolvedValue([]);
    mocks.listAppointmentEventsByAppointmentIds.mockResolvedValue([]);
    mocks.listSpecialistsAllAccounts.mockResolvedValue(specialists);
    mocks.listSpecialistsByAccount.mockResolvedValue(specialists);
    mocks.listClientsByAccount.mockResolvedValue([]);
    mocks.findWebUserById.mockResolvedValue({ id: 30, client_id: 8 });
    mocks.findSpecialistByWebUserId.mockResolvedValue({ id: 5 });
    mocks.findAccountSettingsByAccountId.mockResolvedValue(null);
    mocks.findSpecialistsCalendarCredentials.mockResolvedValue([{
      specialistId: 5,
      webUserId: SPECIALIST_WEB_USER_ID,
      googleApiKey: 'valid-token',
      googleRefreshToken: 'refresh-token',
      googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      timezone: 'UTC',
    }]);
    vi.mocked(axios.get).mockResolvedValue({
      data: { items: [{ summary: SECRET, start: { dateTime: '2026-01-01T10:00:00Z' }, end: { dateTime: '2026-01-01T11:00:00Z' } }] },
    });
    vi.mocked(axios.post).mockResolvedValue({
      data: { calendars: { primary: { busy: [{ start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' }] } } },
    });
  });

  const filters = { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z', specialistId: 5 };

  it('returns the title only to the specialist who owns the Google account', async () => {
    const result = await getAppointments(actor(String(SPECIALIST_WEB_USER_ID), WebUserRole.Specialist), filters);

    expect(result.busySlots).toEqual([
      { specialistId: 5, scheduledAt: '2026-01-01T10:00:00.000Z', durationMin: 60, source: 'google', title: SECRET },
    ]);
  });

  it.each([
    ['an owner viewing another specialist', actor('11', WebUserRole.Owner)],
    ['a client', actor('30', WebUserRole.Client)],
    ['a product admin who is not that web user', actor('99', WebUserRole.ProductAdmin)],
  ])('omits the title for %s', async (_label, requester) => {
    const result = await getAppointments(requester, filters);

    expect(result.busySlots).toEqual([
      { specialistId: 5, scheduledAt: '2026-01-01T10:00:00.000Z', durationMin: 60, source: 'google' },
    ]);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});
