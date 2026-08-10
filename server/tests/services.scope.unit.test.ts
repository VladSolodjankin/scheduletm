import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const repository = vi.hoisted(() => ({
  listServices: vi.fn(), listAssignments: vi.fn(), findSpecialistForUser: vi.fn(),
  listActiveSpecialistIds: vi.fn(), validateActiveSpecialists: vi.fn(), createService: vi.fn(),
  findService: vi.fn(), updateService: vi.fn(), findAssignment: vi.fn(), upsertAssignment: vi.fn(),
  listSpecialistOptions: vi.fn(),
}));
vi.mock('../src/repositories/serviceRepository.js', () => repository);
import { createServiceForActor, getServicesForActor, ServiceCatalogError, updateAssignmentForActor, updateServiceForActor } from '../src/services/serviceService.js';

const specialist = { id: '7', accountId: 2, email: '', role: WebUserRole.Specialist, passwordSalt: '', passwordHash: '', createdAt: '' };
const owner = { ...specialist, role: WebUserRole.Owner };

describe('service scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listServices.mockResolvedValue([]);
    repository.listAssignments.mockResolvedValue([]);
    repository.listSpecialistOptions.mockResolvedValue([]);
    repository.validateActiveSpecialists.mockResolvedValue(true);
  });
  it('limits specialists to their assignment identity', async () => {
    repository.findSpecialistForUser.mockResolvedValue({ id: 11 });
    await getServicesForActor(specialist);
    expect(repository.listServices).toHaveBeenCalledWith(2, 11);
  });
  it('auto assigns the only active specialist', async () => {
    repository.listActiveSpecialistIds.mockResolvedValue([11]);
    repository.createService.mockResolvedValue(4);
    await createServiceForActor(owner, { name: 'A', basePrice: 0, baseDurationMinutes: 30 });
    expect(repository.createService).toHaveBeenCalledWith(expect.objectContaining({ specialistIds: [11], is_active: true }));
  });
  it('forces inactive when no active specialists exist', async () => {
    repository.listActiveSpecialistIds.mockResolvedValue([]);
    repository.createService.mockResolvedValue(4);
    await createServiceForActor(owner, { name: 'A', basePrice: 0, baseDurationMinutes: 30, isActive: true });
    expect(repository.createService).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
  });
  it('prevents specialist editing another assignment', async () => {
    repository.findService.mockResolvedValue({ id: 1 });
    repository.findSpecialistForUser.mockResolvedValue({ id: 11 });
    await expect(updateAssignmentForActor(specialist, 1, 12, { priceOverride: 10 }))
      .rejects.toEqual(new ServiceCatalogError('FORBIDDEN'));
  });
  it('does not replace assignments on a metadata-only update', async () => {
    repository.findService.mockResolvedValue({ id: 1 });
    await updateServiceForActor(owner, 1, { name: 'Renamed' });
    expect(repository.validateActiveSpecialists).not.toHaveBeenCalled();
    expect(repository.updateService).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      name: 'Renamed',
      specialistIds: undefined,
    }));
  });
  it('rejects inactive specialists only when active membership is changed', async () => {
    repository.findService.mockResolvedValue({ id: 1 });
    repository.validateActiveSpecialists.mockResolvedValue(false);
    await expect(updateServiceForActor(owner, 1, { specialistIds: [99] }))
      .rejects.toEqual(new ServiceCatalogError('INVALID_SPECIALISTS'));
    expect(repository.updateService).not.toHaveBeenCalled();
  });
});
