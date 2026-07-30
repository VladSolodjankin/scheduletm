import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../src/types/domain.js';
import { WebUserRole } from '../src/types/webUserRole.js';

const findAnyAccountMock = vi.hoisted(() => vi.fn());
const findByIdMock = vi.hoisted(() => vi.fn());
const updateByIdMock = vi.hoisted(() => vi.fn());
const upsertSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/repositories/specialistRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/specialistRepository.js')>(
    '../src/repositories/specialistRepository.js',
  );
  return {
    ...actual,
    findSpecialistByIdAnyAccount: findAnyAccountMock,
    findSpecialistById: findByIdMock,
    updateSpecialistById: updateByIdMock,
  };
});

vi.mock('../src/repositories/specialistSettingsRepository.js', async () => {
  const actual = await vi.importActual<typeof import('../src/repositories/specialistSettingsRepository.js')>(
    '../src/repositories/specialistSettingsRepository.js',
  );
  return {
    ...actual,
    upsertSpecialistSettingsBySpecialistId: upsertSettingsMock,
  };
});

const { updateSpecialistForActor } = await import('../src/services/specialistService.js');

const productOwner: User = {
  id: '1',
  accountId: 7,
  email: 'product-owner@example.com',
  role: WebUserRole.ProductOwner,
  passwordHash: 'hash',
  passwordSalt: 'salt',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const foreignSpecialist = {
  id: 9,
  account_id: 42,
  code: 'foreign',
  name: 'Foreign Specialist',
  is_active: true,
  user_id: 99,
  timezone: 'UTC',
  slot_step_min: 30,
  default_meeting_link: null,
};

describe('specialist management scope', () => {
  beforeEach(() => {
    findAnyAccountMock.mockReset().mockResolvedValue(foreignSpecialist);
    findByIdMock.mockReset().mockResolvedValue(foreignSpecialist);
    updateByIdMock.mockReset().mockResolvedValue(true);
    upsertSettingsMock.mockReset().mockResolvedValue(undefined);
  });

  it('lets product owners update a specialist in the specialist account', async () => {
    await expect(updateSpecialistForActor(productOwner, foreignSpecialist.id, {
      name: 'Updated specialist',
      defaultMeetingLink: 'https://meet.example.com/default',
    })).resolves.toMatchObject({ id: foreignSpecialist.id });

    expect(findAnyAccountMock).toHaveBeenCalledWith(foreignSpecialist.id);
    expect(findByIdMock).toHaveBeenCalledWith(42, foreignSpecialist.id);
    expect(updateByIdMock).toHaveBeenCalledWith(42, foreignSpecialist.id, expect.objectContaining({
      name: 'Updated specialist',
    }));
    expect(upsertSettingsMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 42,
      specialistId: foreignSpecialist.id,
    }));
  });
});
