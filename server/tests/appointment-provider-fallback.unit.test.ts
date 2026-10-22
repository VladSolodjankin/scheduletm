import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppointmentForActor } from '../src/services/appointmentService.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const ensureFallbackServiceForAccountMock = vi.hoisted(() => vi.fn());
const createAppointmentMock = vi.hoisted(() => vi.fn());
const listAppointmentsMock = vi.hoisted(() => vi.fn());
const findClientByIdMock = vi.hoisted(() => vi.fn());
const updateClientPreferredMeetingProviderMock = vi.hoisted(() => vi.fn());
const findSpecialistByIdMock = vi.hoisted(() => vi.fn());
const findSpecialistBookingPolicyMock = vi.hoisted(() => vi.fn());
const createZoomMeetingMock = vi.hoisted(() => vi.fn());
const createYandexTelemostMeetingMock = vi.hoisted(() => vi.fn());
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
    findSpecialistById: findSpecialistByIdMock,
  };
});

vi.mock('../src/repositories/specialistBookingPolicyRepository.js', () => ({
  findSpecialistBookingPolicy: findSpecialistBookingPolicyMock,
}));

vi.mock('../src/services/zoomService.js', () => ({
  createZoomMeeting: createZoomMeetingMock,
}));

vi.mock('../src/services/yandexService.js', () => ({
  createYandexTelemostMeeting: createYandexTelemostMeetingMock,
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
    findSpecialistByIdMock.mockReset();
    findSpecialistBookingPolicyMock.mockReset();
    createZoomMeetingMock.mockReset();
    createYandexTelemostMeetingMock.mockReset();
    sendAppointmentNotificationByTypeMock.mockReset();

    ensureFallbackServiceForAccountMock.mockResolvedValue(77);
    findSpecialistByIdMock.mockResolvedValue({ id: 10, account_id: 1, user_id: 55, timezone: 'UTC' });
    findClientByIdMock.mockResolvedValue({ id: 20, preferred_meeting_provider: null });
    findSpecialistBookingPolicyMock.mockResolvedValue({
      allowed_meeting_providers: 'zoom,offline,manual',
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
      meetingProvider: 'offline',
    }));
    expect(updateClientPreferredMeetingProviderMock).toHaveBeenCalledWith(1, 20, 'offline');
  });

  it('keeps an explicitly offline appointment without a meeting link', async () => {
    findSpecialistByIdMock.mockResolvedValue({
      id: 10,
      account_id: 1,
      user_id: 55,
      timezone: 'UTC',
    });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
        meetingProvider: 'offline',
        locationAddress: 'Main st. 1',
      },
    );

    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      meetingProvider: 'offline',
      locationAddress: 'Main st. 1',
    }));
  });

  it('creates the Zoom meeting with the specialist web user credentials, not the booking admin', async () => {
    createZoomMeetingMock.mockResolvedValue({ ok: true, meeting: { joinUrl: 'https://zoom.us/j/1', zoomMeetingId: '1' } });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
        meetingProvider: 'zoom',
      },
    );

    expect(createZoomMeetingMock).toHaveBeenCalledWith(expect.objectContaining({ accountId: 1, userId: '55' }));
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      meetingProvider: 'zoom',
      zoomMeetingId: '1',
    }));
  });

  it('falls through without calling Zoom when the specialist has no web user', async () => {
    findSpecialistByIdMock.mockResolvedValue({ id: 10, account_id: 1, user_id: null, timezone: 'UTC' });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
        meetingProvider: 'zoom',
      },
    );

    expect(createZoomMeetingMock).not.toHaveBeenCalled();
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({ meetingProvider: 'offline' }));
  });

  it('falls through when the specialist has not connected Zoom', async () => {
    createZoomMeetingMock.mockResolvedValue({ ok: false, reason: 'zoom_not_connected' });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
        meetingProvider: 'zoom',
      },
    );

    expect(createZoomMeetingMock).toHaveBeenCalledWith(expect.objectContaining({ userId: '55' }));
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({ meetingProvider: 'offline' }));
  });

  it('uses Yandex Telemost with the specialist credentials when it is the first candidate', async () => {
    findSpecialistBookingPolicyMock.mockResolvedValue({
      allowed_meeting_providers: 'yandex_telemost,zoom,offline,manual',
    });
    createYandexTelemostMeetingMock.mockResolvedValue({
      ok: true,
      meeting: { yandexMeetingId: 'abc', joinUrl: 'https://telemost.yandex.ru/j/123' },
    });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
      },
    );

    expect(createYandexTelemostMeetingMock).toHaveBeenCalledWith({ accountId: 1, userId: '55' });
    expect(createZoomMeetingMock).not.toHaveBeenCalled();
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      meetingProvider: 'yandex_telemost',
      meetingLink: 'https://telemost.yandex.ru/j/123',
    }));
  });

  it('falls through from a failed Telemost to the next provider', async () => {
    findSpecialistBookingPolicyMock.mockResolvedValue({
      allowed_meeting_providers: 'yandex_telemost,zoom,offline,manual',
    });
    createYandexTelemostMeetingMock.mockResolvedValue({ ok: false, reason: 'yandex_create_failed' });
    createZoomMeetingMock.mockResolvedValue({ ok: true, meeting: { joinUrl: 'https://zoom.us/j/2', zoomMeetingId: '2' } });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
      },
    );

    expect(createYandexTelemostMeetingMock).toHaveBeenCalledTimes(1);
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({
      meetingProvider: 'zoom',
      meetingLink: 'https://zoom.us/j/2',
    }));
  });

  it('ignores unknown provider ids in the policy and keeps explicit offline offline', async () => {
    findSpecialistBookingPolicyMock.mockResolvedValue({
      allowed_meeting_providers: 'bogus,yandex_telemost,offline',
    });

    await createAppointmentForActor(
      { id: '100', accountId: 1, role: WebUserRole.Owner, email: 'owner@example.com' } as any,
      {
        specialistId: 10,
        clientId: 20,
        appointmentAt: '2026-05-02T10:00:00.000Z',
        appointmentEndAt: '2026-05-02T11:00:00.000Z',
        meetingProvider: 'offline',
      },
    );

    expect(createYandexTelemostMeetingMock).not.toHaveBeenCalled();
    expect(createAppointmentMock).toHaveBeenCalledWith(expect.objectContaining({ meetingProvider: 'offline' }));
  });
});
