import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';
import { getAppointments } from '../src/services/appointmentService.js';

const listAppointmentsAllAccountsMock = vi.hoisted(() => vi.fn());
const listAppointmentsMock = vi.hoisted(() => vi.fn());
const listAppointmentEventsByAppointmentIdsMock = vi.hoisted(() => vi.fn());
const listSpecialistsAllAccountsMock = vi.hoisted(() => vi.fn());
const listSpecialistsByAccountMock = vi.hoisted(() => vi.fn());
const listClientsByAccountMock = vi.hoisted(() => vi.fn());
const listExternalBusySlotsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/appointmentRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/appointmentRepository.js')>(
    '../src/repositories/appointmentRepository.js',
  );
  return {
    ...actual,
    listAppointmentsAllAccounts: listAppointmentsAllAccountsMock,
    listAppointments: listAppointmentsMock,
    listAppointmentEventsByAppointmentIds: listAppointmentEventsByAppointmentIdsMock,
  };
});

vi.mock('../src/repositories/specialistRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/specialistRepository.js')>(
    '../src/repositories/specialistRepository.js',
  );
  return {
    ...actual,
    listSpecialistsAllAccounts: listSpecialistsAllAccountsMock,
    listSpecialistsByAccount: listSpecialistsByAccountMock,
  };
});

vi.mock('../src/repositories/clientRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/clientRepository.js')>(
    '../src/repositories/clientRepository.js',
  );
  return {
    ...actual,
    listClientsByAccount: listClientsByAccountMock,
  };
});

vi.mock('../src/services/calendarAvailabilityService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/calendarAvailabilityService.js')>(
    '../src/services/calendarAvailabilityService.js',
  );
  return {
    ...actual,
    listExternalBusySlots: listExternalBusySlotsMock,
  };
});

describe('appointment events service unit', () => {
  beforeEach(() => {
    listAppointmentsAllAccountsMock.mockReset();
    listAppointmentsMock.mockReset();
    listAppointmentEventsByAppointmentIdsMock.mockReset();
    listSpecialistsAllAccountsMock.mockReset();
    listSpecialistsByAccountMock.mockReset();
    listClientsByAccountMock.mockReset();
    listExternalBusySlotsMock.mockReset();

    const appointments = [
      {
        id: 10,
        account_id: 1,
        specialist_id: 5,
        appointment_at: new Date('2026-04-20T10:00:00.000Z'),
        status: 'confirmed',
        comment: null,
        duration_min: 60,
        is_paid: false,
        user_id: 8,
        service_id: 2,
        created_at: new Date('2026-04-15T00:00:00.000Z'),
        updated_at: new Date('2026-04-15T00:00:00.000Z'),
        client_first_name: 'Ivan',
        client_last_name: 'Petrov',
        client_username: 'ivan',
        client_phone: '+1000000',
        client_email: 'ivan@example.com',
      },
    ];
    const specialists = [{ id: 5, name: 'Spec', timezone: 'UTC', slot_step_min: 30 }];
    listAppointmentsAllAccountsMock.mockResolvedValue(appointments);
    listAppointmentsMock.mockResolvedValue(appointments);
    listSpecialistsAllAccountsMock.mockResolvedValue(specialists);
    listSpecialistsByAccountMock.mockResolvedValue(specialists);
    listClientsByAccountMock.mockResolvedValue([{ id: 8, username: 'ivan', first_name: 'Ivan', last_name: 'Petrov', phone: '+1000000', email: 'ivan@example.com' }]);
    listExternalBusySlotsMock.mockResolvedValue([]);
  });

  it('maps actor context for appointment events and forwards event filters', async () => {
    listAppointmentEventsByAppointmentIdsMock.mockResolvedValue([
      {
        id: 1,
        account_id: 1,
        appointment_id: 10,
        action: 'notify',
        actor_web_user_id: 101,
        metadata_json: null,
        created_at: new Date('2026-04-19T09:00:00.000Z'),
        actor_role: 'owner',
        actor_first_name: 'Owner',
        actor_last_name: 'User',
        actor_email: 'owner@example.com',
      },
    ]);

    const data = await getAppointments(
      {
        id: '101',
        accountId: 1,
        email: 'owner@example.com',
        role: WebUserRole.Owner,
      } as any,
      {
        eventAction: ['notify'],
        eventActorWebUserId: 101,
        eventFrom: '2026-04-01T00:00:00.000Z',
        eventTo: '2026-04-30T23:59:59.999Z',
        eventLimit: 25,
      },
    );

    expect(listAppointmentEventsByAppointmentIdsMock).toHaveBeenCalledWith(
      1,
      [10],
      expect.objectContaining({
        actions: ['notify'],
        actorWebUserId: 101,
        limit: 25,
      }),
    );
    expect(data.appointments[0].events[0]).toMatchObject({
      action: 'notify',
      actor: {
        id: 101,
        role: 'owner',
        displayName: 'Owner User',
        email: 'owner@example.com',
      },
    });
    expect(listAppointmentsMock).toHaveBeenCalledWith(expect.objectContaining({ accountId: 1 }));
    expect(listAppointmentsAllAccountsMock).not.toHaveBeenCalled();
  });

  it('uses actor email fallback for displayName when first/last names are missing (edge case)', async () => {
    listAppointmentEventsByAppointmentIdsMock.mockResolvedValue([
      {
        id: 2,
        account_id: 1,
        appointment_id: 10,
        action: 'cancel',
        actor_web_user_id: 102,
        metadata_json: null,
        created_at: new Date('2026-04-19T09:00:00.000Z'),
        actor_role: 'admin',
        actor_first_name: null,
        actor_last_name: null,
        actor_email: 'admin@example.com',
      },
    ]);

    const data = await getAppointments(
      {
        id: '101',
        accountId: 1,
        email: 'owner@example.com',
        role: WebUserRole.Owner,
      } as any,
      {},
    );

    expect(data.appointments[0].events[0].actor.displayName).toBe('admin@example.com');
  });

  it('uses all-account appointment repositories only for product owners', async () => {
    listAppointmentEventsByAppointmentIdsMock.mockResolvedValue([]);

    await getAppointments(
      {
        id: '100',
        accountId: 1,
        email: 'product-owner@example.com',
        role: WebUserRole.ProductOwner,
      } as any,
      {},
    );

    expect(listAppointmentsAllAccountsMock).toHaveBeenCalledOnce();
    expect(listSpecialistsAllAccountsMock).toHaveBeenCalledOnce();
    expect(listAppointmentsMock).not.toHaveBeenCalled();
    expect(listSpecialistsByAccountMock).not.toHaveBeenCalled();
  });
});
