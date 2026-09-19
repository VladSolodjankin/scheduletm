import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const listAppointmentsMock = vi.hoisted(() => vi.fn());
const findAccountSettingsByAccountIdMock = vi.hoisted(() => vi.fn());
const findSpecialistByWebUserIdMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/appointmentRepository.js')>(
    '../src/repositories/appointmentRepository.js',
  );
  return {
    ...actual,
    listAppointments: listAppointmentsMock,
  };
});

vi.mock('../src/repositories/accountSettingsRepository.js', () => ({
  findAccountSettingsByAccountId: findAccountSettingsByAccountIdMock,
}));

vi.mock('../src/repositories/specialistRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/specialistRepository.js')>(
    '../src/repositories/specialistRepository.js',
  );
  return {
    ...actual,
    findSpecialistByWebUserId: findSpecialistByWebUserIdMock,
  };
});

const { getAppointments } = await import('../src/services/appointmentService.js');

const specialistActor = {
  id: '9',
  accountId: 1,
  email: 'specialist@example.com',
  role: WebUserRole.Specialist,
} as any;

describe('specialist appointment visibility scope', () => {
  beforeEach(() => {
    listAppointmentsMock.mockReset().mockResolvedValue([]);
    findAccountSettingsByAccountIdMock.mockReset();
    findSpecialistByWebUserIdMock.mockReset().mockResolvedValue({ id: 5 });
  });

  it('restricts a specialist to their own appointments when the workspace flag is off', async () => {
    findAccountSettingsByAccountIdMock.mockResolvedValue({ specialists_see_all_appointments: false });

    await getAppointments(specialistActor, {});

    expect(listAppointmentsMock).toHaveBeenCalledWith(expect.objectContaining({ specialistId: 5 }));
  });

  it('restricts a specialist to their own appointments when there is no account settings row', async () => {
    findAccountSettingsByAccountIdMock.mockResolvedValue(null);

    await getAppointments(specialistActor, {});

    expect(listAppointmentsMock).toHaveBeenCalledWith(expect.objectContaining({ specialistId: 5 }));
  });

  it('lets a specialist see every workspace appointment when the owner enables the flag', async () => {
    findAccountSettingsByAccountIdMock.mockResolvedValue({ specialists_see_all_appointments: true });

    await getAppointments(specialistActor, {});

    expect(findSpecialistByWebUserIdMock).not.toHaveBeenCalled();
    expect(listAppointmentsMock).toHaveBeenCalledWith(expect.objectContaining({ specialistId: undefined }));
  });
});
