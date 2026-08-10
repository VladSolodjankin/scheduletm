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
  getPublicBookingOptions,
} = await import('../src/services/publicBookingService.js');

describe('public booking service', () => {
  beforeEach(() => {
    Object.values(pageRepository).forEach((mock) => mock.mockReset());
    Object.values(bookingRepository).forEach((mock) => mock.mockReset());
    calendarAvailability.listExternalBusySlots.mockReset().mockResolvedValue([]);
    pageRepository.findPublishedPublicPageBySlug.mockResolvedValue({ account_id: 7 });
  });

  it('scopes booking options to the published page account', async () => {
    bookingRepository.listPublicBookingSpecialists.mockResolvedValue([
      { id: 2, account_id: 7, name: 'Jane Smith', is_active: true, timezone: 'UTC' },
    ]);
    bookingRepository.listPublicBookingServices.mockResolvedValue([
      { id: 3, account_id: 7, name_en: 'Consultation', name_ru: 'Консультация', duration_min: 60, price: 100, currency: 'RUB' },
    ]);

    await expect(getPublicBookingOptions('valid-page')).resolves.toEqual({
      specialists: [{ id: 2, name: 'Jane Smith' }],
      services: [{ id: 3, name: 'Consultation', durationMin: 60, price: 100, currency: 'RUB' }],
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
      id: 10, status: 'new', appointment_at: new Date('2030-08-01T10:00:00.000Z'), duration_min: 45,
    });

    await bookPublicAppointment('valid-page', {
      firstName: 'Guest', lastName: 'User', phone: '+10000000000',
      specialistId: 2, serviceId: 3, startAt: '2030-08-01T10:00:00.000Z',
    });

    expect(bookingRepository.findPublicBookingService).toHaveBeenCalledWith(7, 3, 2);
    expect(bookingRepository.createPublicGuestAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ specialistId: 2, serviceId: 3, durationMin: 45, price: 250 }),
    );
  });

  it('redacts status and treats a wrong specialist surname as not found', async () => {
    bookingRepository.findPublicAppointmentStatus.mockResolvedValue({
      id: 10,
      status: 'confirmed',
      appointment_at: new Date('2026-08-01T10:00:00.000Z'),
      duration_min: 60,
      comment: 'meetingProvider: zoom\nmeetingLink: https://zoom.us/j/123\nprivate note',
      specialist_name: 'Jane Smith',
      service_name_en: 'Consultation',
      service_name_ru: 'Консультация',
      business_address: 'Private office',
      client_email: 'must-not-leak@example.com',
    });

    const result = await getPublicAppointmentStatus('valid-page', 10, ' smith ');
    expect(result).toEqual({
      status: 'confirmed',
      scheduledAt: '2026-08-01T10:00:00.000Z',
      duration: 60,
      service: 'Consultation',
      specialist: 'Jane Smith',
      meeting: { provider: 'zoom', meetingUrl: 'https://zoom.us/j/123' },
    });
    await expect(getPublicAppointmentStatus('valid-page', 10, 'Jones'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
