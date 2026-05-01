import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppointmentForActor } from '../src/services/appointmentService.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const ensureFallbackServiceForAccountMock = vi.hoisted(() => vi.fn());
const createAppointmentMock = vi.hoisted(() => vi.fn());
const listAppointmentsMock = vi.hoisted(() => vi.fn());
const findClientByIdMock = vi.hoisted(() => vi.fn());
const updateClientPreferredMeetingProviderMock = vi.hoisted(() => vi.fn());
const findSpecialistByIdAnyAccountMock = vi.hoisted(() => vi.fn());
const findSpecialistBookingPolicyMock = vi.hoisted(() => vi.fn());
const createZoomMeetingMock = vi.hoisted(() => vi.fn());
const sendAppointmentNotificationByTypeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/appointmentRepository.js')>('../src/repositories/appointmentRepository.js');
  return {
    ...actual,
    ensureFallbackServiceForAccount: ensureFallbackServiceForAccountMock,
    createAppointment: createAppointmentMock,
    listAppointments: listAppointmentsMock,
  };
});

vi.mock('../src/repositories/clientRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/clientRepository.js')>('../src/repositories/clientRepository.js');
  return {
    ...actual,
    findClientById: findClientByIdMock,
    updateClientPreferredMeetingProvider: updateClientPreferredMeetingProviderMock,
  };
});

vi.mock('../src/repositories/specialistRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/specialistRepository.js')>('../src/repositories/specialistRepository.js');
  return {
    ...actual,
    findSpecialistByIdAnyAccount: findSpecialistByIdAnyAccountMock,
  };
});

vi.mock('../src/repositories/specialistBookingPolicyRepository.js', () => ({
  findSpecialistBookingPolicy: findSpecialistBookingPolicyMock,
}));

vi.mock('../src/services/zoomService.js', () => ({
  createZoomMeeting: createZoomMeetingMock,
}));

vi.mock('../src/services/appointmentNotificationService.js', () => ({
  sendAppointmentNotificationByType: sendAppointmentNotificationByTypeMock,
}));

describe('appointment provider fallback unit', () => {
  beforeEach(() => {
    ensureFallbackServiceForAccountMock.mockReset();
    createAppointmentMock.mockReset();
    listAppointmentsMock.mockReset();
    findClientByIdMock.mockReset();
    updateClientPreferredMeetingProviderMock.mockReset();
    findSpecialistByIdAnyAccountMock.mockReset();
    findSpecialistBookingPolicyMock.mockReset();
    createZoomMeetingMock.mockReset();
    sendAppointmentNotificationByTypeMock.mockReset();

    ensureFallbackServiceForAccountMock.mockResolvedValue(77);
    findSpecialistByIdAnyAccountMock.mockResolvedValue({ id: 10, timezone: 'UTC' });
    findClientByIdMock.mockResolvedValue({ id: 20, preferred_meeting_provider: null });
    findSpecialistBookingPolicyMock.mockResolvedValue({
      allowed_meeting_providers: 'offline,zoom,manual',
      meeting_providers_priority: 'zoom,offline,manual',
    });
    updateClientPreferredMeetingProviderMock.mockResolvedValue(undefined);
    createAppointmentMock.mockResolvedValue({
      id: 900,
      account_id: 1,
      specialist_id: 10,
      appointment_at: new Date('2026-05-02T10:00:00.000Z'),
      status: 'new',
      comment: null,
      duration_min: 60,
      is_paid: false,
      user_id: 20,
      service_id: 77,
      created_at: new Date('2026-05-01T10:00:00.000Z'),
      updated_at: new Date('2026-05-01T10:00:00.000Z'),
    });
    listAppointmentsMock.mockResolvedValue([
      {
        id: 900,
        account_id: 1,
        specialist_id: 10,
        appointment_at: new Date('2026-05-02T10:00:00.000Z'),
        status: 'new',
        comment: 'meetingProvider: offline\nlocationAddress: Main st. 1',
        duration_min: 60,
        is_paid: false,
        user_id: 20,
        service_id: 77,
        created_at: new Date('2026-05-01T10:00:00.000Z'),
        updated_at: new Date('2026-05-01T10:00:00.000Z'),
        client_first_name: 'Ivan',
        client_last_name: 'Petrov',
        client_username: 'ivan',
        client_phone: '+10000000',
        client_email: 'ivan@example.com',
      },
    ]);
    sendAppointmentNotificationByTypeMock.mockResolvedValue(undefined);
  });

  it('falls back to offline when zoom creation fails and saves offline preference', async () => {
    createZoomMeetingMock.mockResolvedValue({ ok: false, reason: 'zoom_create_failed' });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
        meetingProvider: 'zoom',
        locationAddress: 'Main st. 1',
      },
    );

    expect(createZoomMeetingMock).toHaveBeenCalledTimes(1);
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      notes: expect.stringContaining('meetingProvider: offline'),
    }));
    expect(updateClientPreferredMeetingProviderMock).toHaveBeenCalledWith(1, 20, 'offline');
  });
});
