import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserSessionState } from '../../types/session';

vi.mock('../../repositories/service.repository', () => {
  return {
    findActiveServices: vi.fn(),
    findServiceById: vi.fn(),
  };
});

vi.mock('../../repositories/specialist.repository', () => {
  return {
    findActiveSpecialists: vi.fn(),
    findSingleDefaultActiveSpecialist: vi.fn(),
    findSpecialistById: vi.fn(),
  };
});

vi.mock('../../repositories/user-session.repository', () => {
  return {
    mergeSessionPayload: vi.fn(),
    updateSessionState: vi.fn(),
  };
});

vi.mock('../date.service', () => {
  return {
    getNextAvailableDates: vi.fn(),
  };
});

import {
  findActiveServices,
  findServiceById,
} from '../../repositories/service.repository';
import {
  findActiveSpecialists,
  findSingleDefaultActiveSpecialist,
  findSpecialistById,
} from '../../repositories/specialist.repository';
import {
  mergeSessionPayload,
  updateSessionState,
} from '../../repositories/user-session.repository';
import { getNextAvailableDates } from '../date.service';

import {
  selectService,
  selectSpecialist,
  startBooking,
} from '../booking.service';

describe('booking.service', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('startBooking sets state and returns active services', async () => {
    vi.mocked(findActiveServices).mockResolvedValue([{ id: 1 }] as any);

    const out = await startBooking(7, 123);

    expect(updateSessionState).toHaveBeenCalledWith(
      7,
      123,
      UserSessionState.CHOOSING_SERVICE,
      {},
    );
    expect(out).toEqual([{ id: 1 }]);
  });

  it('selectService returns service_not_found for missing/inactive service', async () => {
    vi.mocked(findServiceById).mockResolvedValue(null as any);

    const out = await selectService(7, 1, 999);

    expect(out).toEqual({ ok: false, reason: 'service_not_found' });
    expect(mergeSessionPayload).not.toHaveBeenCalled();
  });

  it('selectService skips specialist step when there is a single default specialist', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ id: 10, is_active: true } as any);
    vi.mocked(findSingleDefaultActiveSpecialist).mockResolvedValue({ id: 77 } as any);
    vi.mocked(getNextAvailableDates).mockResolvedValue(['2026-04-20'] as any);

    const out = await selectService(7, 1, 10);

    expect(mergeSessionPayload).toHaveBeenCalledWith(
      7,
      1,
      UserSessionState.CHOOSING_SPECIALIST,
      { serviceId: 10 },
    );
    expect(mergeSessionPayload).toHaveBeenCalledWith(
      7,
      1,
      UserSessionState.CHOOSING_DATE,
      { serviceId: 10, specialistId: 77 },
    );

    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.skipSpecialist).toBe(true);
    expect(out.dates).toEqual(['2026-04-20']);
  });

  it('selectService returns specialists list when default specialist does not exist', async () => {
    vi.mocked(findServiceById).mockResolvedValue({ id: 10, is_active: true } as any);
    vi.mocked(findSingleDefaultActiveSpecialist).mockResolvedValue(null as any);
    vi.mocked(findActiveSpecialists).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);

    const out = await selectService(7, 1, 10);

    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.skipSpecialist).toBe(false);
    expect(out.specialists).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('selectSpecialist returns specialist_not_found for missing/inactive specialist', async () => {
    vi.mocked(findSpecialistById).mockResolvedValue({ is_active: false } as any);

    const out = await selectSpecialist(7, 1, 123);

    expect(out).toEqual({ ok: false, reason: 'specialist_not_found' });
    expect(mergeSessionPayload).not.toHaveBeenCalled();
  });

  it('selectSpecialist merges specialistId and returns dates', async () => {
    vi.mocked(findSpecialistById).mockResolvedValue({ id: 5, is_active: true } as any);
    vi.mocked(getNextAvailableDates).mockResolvedValue(['2026-04-20', '2026-04-21'] as any);

    const out = await selectSpecialist(7, 1, 5);

    expect(mergeSessionPayload).toHaveBeenCalledWith(
      7,
      1,
      UserSessionState.CHOOSING_DATE,
      { specialistId: 5 },
    );

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.dates).toEqual(['2026-04-20', '2026-04-21']);
  });
});
