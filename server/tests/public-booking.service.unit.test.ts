import { beforeEach, describe, expect, it, vi } from 'vitest';

const pageRepository = vi.hoisted(() => ({ findPublishedPublicPageBySlug: vi.fn() }));
const bookingRepository = vi.hoisted(() => ({
  listPublicBookingSpecialists: vi.fn(),
  listPublicBookingServices: vi.fn(),
  findPublicBookingSpecialist: vi.fn(),
  findPublicBookingService: vi.fn(),
  createPublicGuestAppointment: vi.fn(),
  findPublicAppointmentStatus: vi.fn(),
}));
const calendarAvailability = vi.hoisted(() => ({ listExternalBusySlots: vi.fn() }));
const appointments = vi.hoisted(() => ({ listAppointments: vi.fn() }));
const notifications = vi.hoisted(() => ({ sendAppointmentNotificationByType: vi.fn() }));
const bookingInvite = vi.hoisted(() => ({ ensurePublicBookingClientInvite: vi.fn() }));
vi.mock('../src/repositories/appointmentRepository.js', () => appointments);
vi.mock('../src/services/appointmentNotificationService.js', () => notifications);
vi.mock('../src/services/publicBookingInviteService.js', () => bookingInvite);

vi.mock('../src/repositories/publicPageRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/publicPageRepository.js')>(
    '../src/repositories/publicPageRepository.js',
  );
  return { ...actual, ...pageRepository };
});
vi.mock('../src/repositories/publicBookingRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/publicBookingRepository.js')>(
    '../src/repositories/publicBookingRepository.js',
  );
  return { ...actual, ...bookingRepository };
});
vi.mock('../src/services/calendarAvailabilityService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/calendarAvailabilityService.js')>(
    '../src/services/calendarAvailabilityService.js',
  );
  return { ...actual, ...calendarAvailability };
});

const {
  bookPublicAppointment,
  getPublicAppointmentStatus,
  getPublicAvailableSlots,
  getPublicBookingOptions,
} = await import('../src/services/publicBookingService.js');

describe('public booking service', () => {
  beforeEach(() => {
    Object.values(pageRepository).forEach((mock) => mock.mockReset());
    Object.values(bookingRepository).forEach((mock) => mock.mockReset());
    calendarAvailability.listExternalBusySlots.mockReset().mockResolvedValue([]);
    appointments.listAppointments.mockReset().mockResolvedValue([]);
    notifications.sendAppointmentNotificationByType.mockReset().mockResolvedValue({ delivered: false });
    bookingInvite.ensurePublicBookingClientInvite.mockReset().mockResolvedValue(undefined);
    pageRepository.findPublishedPublicPageBySlug.mockResolvedValue({ account_id: 7 });
  });

  it('scopes booking options to the published page account', async () => {
    bookingRepository.listPublicBookingSpecialists.mockResolvedValue([
      { id: 2, account_id: 7, name: 'Jane Smith', is_active: true, timezone: 'UTC' },
    ]);
    bookingRepository.listPublicBookingServices.mockResolvedValue([
      {
        id: 3,
        account_id: 7,
        name_en: 'Consultation',
        name_ru: 'Консультация',
        description: 'Individual consultation',
        duration_min: 60,
        price: 100,
        currency: 'RUB',
        is_first_free: true,
        image_media_id: '07a860c5-e230-4e76-b0f1-3db60fa445e8',
      },
    ]);

    await expect(getPublicBookingOptions('valid-page')).resolves.toEqual({
      specialists: [{ id: 2, name: 'Jane Smith' }],
      services: [{
        id: 3,
        name: 'Consultation',
        durationMin: 60,
        price: 100,
        currency: 'RUB',
        description: 'Individual consultation',
        firstSessionFree: true,
        imageUrl: expect.stringContaining('/api/public-pages/media/07a860c5-e230-4e76-b0f1-3db60fa445e8/content'),
      }],
    });
    expect(bookingRepository.listPublicBookingSpecialists).toHaveBeenCalledWith(7);
    expect(bookingRepository.listPublicBookingServices).toHaveBeenCalledWith(7);
  });

  it('rejects past and out-of-hours slots before creating an appointment', async () => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
      id: 2,
      account_id: 7,
      name: 'Jane Smith',
      is_active: true,
      timezone: 'UTC',
      work_start_hour: 9,
      work_end_hour: 18,
      work_days: '1,2,3,4,5,6',
      slot_step_min: 30,
    });
    bookingRepository.findPublicBookingService.mockResolvedValue({
      id: 3,
      account_id: 7,
      duration_min: 60,
      price: 100,
      currency: 'RUB',
    });

    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest',
      lastName: 'User',
      phone: '+10000000000',
      specialistId: 2,
      serviceId: 3,
      startAt: '2020-08-01T10:00:00.000Z',
    })).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest',
      lastName: 'User',
      phone: '+10000000000',
      specialistId: 2,
      serviceId: 3,
      startAt: '2030-08-01T18:00:00.000Z',
    })).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    expect(bookingRepository.createPublicGuestAppointment).not.toHaveBeenCalled();
  });

  it.each(['2030-08-01T17:00:01.000Z', '2030-08-01T17:00:00.001Z'])('rejects sub-minute slot %s before side effects', async (startAt) => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
      id: 2, timezone: 'UTC', work_start_hour: 9, work_end_hour: 18,
      work_days: '1,2,3,4,5,6', slot_step_min: 30,
    });
    bookingRepository.findPublicBookingService.mockResolvedValue({ id: 3, duration_min: 60 });
    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest', lastName: 'User', phone: '+10000000000',
      specialistId: 2, serviceId: 3, startAt,
    })).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    expect(calendarAvailability.listExternalBusySlots).not.toHaveBeenCalled();
    expect(bookingRepository.createPublicGuestAppointment).not.toHaveBeenCalled();
  });

  it('rejects a slot occupied in the specialist external calendar', async () => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
      id: 2,
      account_id: 7,
      name: 'Jane Smith',
      is_active: true,
      timezone: 'UTC',
      work_start_hour: 9,
      work_end_hour: 18,
      work_days: '1,2,3,4,5,6',
      slot_step_min: 30,
    });
    bookingRepository.findPublicBookingService.mockResolvedValue({
      id: 3,
      account_id: 7,
      duration_min: 60,
      price: 100,
      currency: 'RUB',
    });
    calendarAvailability.listExternalBusySlots.mockResolvedValue([{
      specialistId: 2,
      scheduledAt: '2030-08-01T10:30:00.000Z',
      durationMin: 30,
      source: 'google',
    }]);

    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest',
      lastName: 'User',
      phone: '+10000000000',
      specialistId: 2,
      serviceId: 3,
      startAt: '2030-08-01T10:00:00.000Z',
    })).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    expect(bookingRepository.createPublicGuestAppointment).not.toHaveBeenCalled();
  });

  it('rejects selections outside the page account', async () => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue(null);
    bookingRepository.findPublicBookingService.mockResolvedValue({
      id: 3, account_id: 7, duration_min: 60,
    });

    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest',
      lastName: 'User',
      email: 'guest@example.com',
      specialistId: 99,
      serviceId: 3,
      startAt: '2026-08-01T10:00:00.000Z',
    })).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    expect(bookingRepository.createPublicGuestAppointment).not.toHaveBeenCalled();
  });

  it('validates the active service-specialist assignment and uses its effective values', async () => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
      id: 2, account_id: 7, name: 'Jane Smith', is_active: true, timezone: 'UTC',
      work_start_hour: 9, work_end_hour: 18, work_days: '1,2,3,4,5,6', slot_step_min: 30,
    });
    bookingRepository.findPublicBookingService.mockResolvedValue({
      id: 3, account_id: 7, duration_min: 45, price: 250, currency: 'RUB',
    });
    bookingRepository.createPublicGuestAppointment.mockResolvedValue({
      id: 10, status: 'new', appointment_at: new Date('2030-08-01T10:00:00.000Z'), duration_min: 45, client_id: 42,
    });

    await bookPublicAppointment('valid-page', {
      firstName: 'Guest', lastName: 'User', phone: '+10000000000',
      specialistId: 2, serviceId: 3, startAt: '2030-08-01T10:00:00.000Z',
    });

    expect(bookingRepository.findPublicBookingService).toHaveBeenCalledWith(7, 3, 2);
    expect(bookingRepository.createPublicGuestAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ specialistId: 2, serviceId: 3, durationMin: 45, price: 250 }),
    );
    expect(bookingInvite.ensurePublicBookingClientInvite).not.toHaveBeenCalled();
  });

  it.each([false, true])('attempts notification after commit and preserves booking on delivery failure=%s', async (fails) => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
      id: 2, timezone: 'UTC', work_start_hour: 9, work_end_hour: 18,
      work_days: '1,2,3,4,5,6', slot_step_min: 30,
    });
    bookingRepository.findPublicBookingService.mockResolvedValue({ id: 3, duration_min: 60 });
    bookingRepository.createPublicGuestAppointment.mockResolvedValue({
      id: 10, status: 'new', appointment_at: new Date('2030-08-01T10:00:00Z'), duration_min: 60, client_id: 42,
    });
    const hydrated = { id: 10, account_id: 7, specialist_id: 2, client_email: 'guest@example.com' };
    appointments.listAppointments.mockResolvedValue([hydrated]);
    if (fails) notifications.sendAppointmentNotificationByType.mockRejectedValue(new Error('delivery unavailable'));
    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest', lastName: 'User', email: 'guest@example.com',
      specialistId: 2, serviceId: 3, startAt: '2030-08-01T10:00:00Z',
    })).resolves.toMatchObject({ id: 10, status: 'new' });
    expect(appointments.listAppointments).toHaveBeenCalledWith(expect.objectContaining({ accountId: 7, specialistId: 2 }));
    expect(bookingInvite.ensurePublicBookingClientInvite).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7, clientId: 42, email: 'guest@example.com', firstName: 'Guest', lastName: 'User',
    }));
    expect(notifications.sendAppointmentNotificationByType).toHaveBeenCalledWith({
      accountId: 7, appointment: hydrated, notificationType: 'appointment_created',
    });
    expect(bookingRepository.createPublicGuestAppointment).toHaveBeenCalledTimes(1);
    expect(bookingRepository.createPublicGuestAppointment.mock.invocationCallOrder[0])
      .toBeLessThan(notifications.sendAppointmentNotificationByType.mock.invocationCallOrder[0]);
  });

  it('preserves the booking when the client invite fails to send', async () => {
    bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
      id: 2, timezone: 'UTC', work_start_hour: 9, work_end_hour: 18,
      work_days: '1,2,3,4,5,6', slot_step_min: 30,
    });
    bookingRepository.findPublicBookingService.mockResolvedValue({ id: 3, duration_min: 60 });
    bookingRepository.createPublicGuestAppointment.mockResolvedValue({
      id: 10, status: 'new', appointment_at: new Date('2030-08-01T10:00:00Z'), duration_min: 60, client_id: 42,
    });
    bookingInvite.ensurePublicBookingClientInvite.mockRejectedValue(new Error('invite unavailable'));

    await expect(bookPublicAppointment('valid-page', {
      firstName: 'Guest', lastName: 'User', email: 'guest@example.com',
      specialistId: 2, serviceId: 3, startAt: '2030-08-01T10:00:00Z',
    })).resolves.toMatchObject({ id: 10, status: 'new' });
  });

  it('redacts status and treats a wrong access code as not found', async () => {
    bookingRepository.findPublicAppointmentStatus.mockResolvedValue({
      id: 10,
      status: 'confirmed',
      appointment_at: new Date('2026-08-01T10:00:00.000Z'),
      duration_min: 60,
      meeting_provider: 'zoom',
      meeting_link: 'https://zoom.us/j/123',
      location_address: null,
      specialist_name: 'Jane Smith',
      service_name_en: 'Consultation',
      service_name_ru: 'Консультация',
      business_address: 'Private office',
      client_email: 'must-not-leak@example.com',
      public_access_code: 'ABCDEFGHJK',
    });

    const result = await getPublicAppointmentStatus('valid-page', 10, ' abcdefghjk ');
    expect(result).toEqual({
      status: 'confirmed',
      scheduledAt: '2026-08-01T10:00:00.000Z',
      duration: 60,
      service: 'Consultation',
      specialist: 'Jane Smith',
      meeting: { provider: 'zoom', meetingUrl: 'https://zoom.us/j/123' },
    });
    await expect(getPublicAppointmentStatus('valid-page', 10, 'WRONGCODE1'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  describe('getPublicAvailableSlots', () => {
    beforeEach(() => {
      bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
        id: 2, account_id: 7, name: 'Jane Smith', is_active: true, timezone: 'UTC',
        work_start_hour: 9, work_end_hour: 18, work_days: '1,2,3,4,5,6,7', slot_step_min: 60,
      });
      bookingRepository.findPublicBookingService.mockResolvedValue({
        id: 3, account_id: 7, duration_min: 60, price: 100, currency: 'RUB',
      });
    });

    it('lists hourly slots across the working day when nothing is booked', async () => {
      const result = await getPublicAvailableSlots('valid-page', 2, 3, '2030-08-01');
      expect(result.slots).toEqual([
        '2030-08-01T09:00:00.000Z', '2030-08-01T10:00:00.000Z', '2030-08-01T11:00:00.000Z',
        '2030-08-01T12:00:00.000Z', '2030-08-01T13:00:00.000Z', '2030-08-01T14:00:00.000Z',
        '2030-08-01T15:00:00.000Z', '2030-08-01T16:00:00.000Z', '2030-08-01T17:00:00.000Z',
      ]);
    });

    it('excludes slots overlapping an existing internal appointment', async () => {
      appointments.listAppointments.mockResolvedValue([
        { id: 99, status: 'new', appointment_at: new Date('2030-08-01T10:00:00.000Z'), duration_min: 60 },
      ]);

      const result = await getPublicAvailableSlots('valid-page', 2, 3, '2030-08-01');
      expect(result.slots).not.toContain('2030-08-01T10:00:00.000Z');
      expect(result.slots).toContain('2030-08-01T09:00:00.000Z');
    });

    it('ignores cancelled internal appointments', async () => {
      appointments.listAppointments.mockResolvedValue([
        { id: 99, status: 'cancelled', appointment_at: new Date('2030-08-01T10:00:00.000Z'), duration_min: 60 },
      ]);

      const result = await getPublicAvailableSlots('valid-page', 2, 3, '2030-08-01');
      expect(result.slots).toContain('2030-08-01T10:00:00.000Z');
    });

    it('returns no slots on a day the specialist does not work', async () => {
      bookingRepository.findPublicBookingSpecialist.mockResolvedValue({
        id: 2, account_id: 7, name: 'Jane Smith', is_active: true, timezone: 'UTC',
        work_start_hour: 9, work_end_hour: 18, work_days: '1,2,3,4,5', slot_step_min: 60,
      });

      const result = await getPublicAvailableSlots('valid-page', 2, 3, '2030-08-03');
      expect(result.slots).toEqual([]);
    });

    it('rejects an unknown specialist/service pair', async () => {
      bookingRepository.findPublicBookingService.mockResolvedValue(null);
      await expect(getPublicAvailableSlots('valid-page', 2, 3, '2030-08-01'))
        .rejects.toMatchObject({ code: 'INVALID_SELECTION' });
    });
  });
});
