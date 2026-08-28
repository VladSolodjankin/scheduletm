import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';
import { env } from '../src/config/env.js';

const repository = vi.hoisted(() => ({
  listServices: vi.fn(), listAssignments: vi.fn(), findSpecialistForUser: vi.fn(),
  listActiveSpecialistIds: vi.fn(), validateActiveSpecialists: vi.fn(), createService: vi.fn(),
  findService: vi.fn(), updateService: vi.fn(), findAssignment: vi.fn(), upsertAssignment: vi.fn(),
  listSpecialistOptions: vi.fn(), getServiceDeleteImpact: vi.fn(), deleteService: vi.fn(),
}));
const mediaRepository = vi.hoisted(() => ({ findAccountMedia: vi.fn() }));
vi.mock('../src/repositories/serviceRepository.js', () => repository);
vi.mock('../src/repositories/publicPageMediaRepository.js', () => mediaRepository);
import {
  createServiceForActor,
  deleteServiceForActor,
  getServiceDeleteImpactForActor,
  getServicesForActor,
  ServiceCatalogError,
  updateAssignmentForActor,
  updateServiceForActor,
} from '../src/services/serviceService.js';

const specialist = { id: '7', accountId: 2, email: '', role: WebUserRole.Specialist, passwordSalt: '', passwordHash: '', createdAt: '' };
const owner = { ...specialist, role: WebUserRole.Owner };

describe('service scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listServices.mockResolvedValue([]);
    repository.listAssignments.mockResolvedValue([]);
    repository.listSpecialistOptions.mockResolvedValue([]);
    repository.validateActiveSpecialists.mockResolvedValue(true);
    mediaRepository.findAccountMedia.mockResolvedValue(null);
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
  it('stores only an owned media id', async () => {
    const mediaId = '07a860c5-e230-4e76-b0f1-3db60fa445e8';
    repository.listActiveSpecialistIds.mockResolvedValue([11]);
    repository.createService.mockResolvedValue(4);
    mediaRepository.findAccountMedia.mockResolvedValue({ id: mediaId, account_id: 2 });

    await createServiceForActor(owner, {
      name: 'A', basePrice: 0, baseDurationMinutes: 30, imageMediaId: mediaId,
    });

    expect(mediaRepository.findAccountMedia).toHaveBeenCalledWith(2, mediaId);
    expect(repository.createService).toHaveBeenCalledWith(expect.objectContaining({
      image_media_id: mediaId,
    }));
    expect(repository.createService.mock.calls[0]![0]).not.toHaveProperty('image_url');
  });
  it('does not accept media owned by another account', async () => {
    repository.listActiveSpecialistIds.mockResolvedValue([11]);
    const mediaId = '07a860c5-e230-4e76-b0f1-3db60fa445e8';

    await expect(createServiceForActor(owner, {
      name: 'A', basePrice: 0, baseDurationMinutes: 30, imageMediaId: mediaId,
    })).rejects.toEqual(new ServiceCatalogError('MEDIA_NOT_FOUND'));
    expect(repository.createService).not.toHaveBeenCalled();
  });
  it('clears the managed image id', async () => {
    repository.findService.mockResolvedValue({ id: 1 });

    await updateServiceForActor(owner, 1, { imageMediaId: null });

    expect(repository.updateService).toHaveBeenCalledWith(expect.objectContaining({
      image_media_id: null,
    }));
    expect(repository.updateService.mock.calls[0]![0]).not.toHaveProperty('image_url');
  });
  it('derives the response image URL from the managed media id', async () => {
    const mediaId = '07a860c5-e230-4e76-b0f1-3db60fa445e8';
    repository.listServices.mockResolvedValue([{
      id: 1, account_id: 2, name: 'A', description: null, price: 0, duration_min: 30,
      is_first_free: false, image_media_id: mediaId, is_active: true,
    }, {
      id: 2, account_id: 2, name: 'Inactive', description: null, price: 0, duration_min: 30,
      is_first_free: false, image_media_id: mediaId, is_active: false,
    }]);

    const result = await getServicesForActor(owner);
    const expectedImageUrl = new URL(`/api/public-pages/media/${mediaId}/content`, env.API_BASE_URL);
    expectedImageUrl.protocol = 'https:';
    expect(result.services[0]).toMatchObject({ imageMediaId: mediaId, imageUrl: expectedImageUrl.toString() });
    expect(result.services[1]).toMatchObject({ imageMediaId: mediaId, imageUrl: null, isActive: false });
  });
  it('returns account-scoped delete impact only to service managers', async () => {
    const impact = {
      serviceId: 1, appointmentCount: 2, appointmentGroupCount: 1, publicPageCount: 1, canDelete: false,
    };
    repository.getServiceDeleteImpact.mockResolvedValue(impact);

    await expect(getServiceDeleteImpactForActor(owner, 1)).resolves.toEqual({
      canDelete: false,
      impact: { appointments: 2, appointmentGroups: 1, publicPages: 1 },
    });
    expect(repository.getServiceDeleteImpact).toHaveBeenCalledWith(2, 1);
    await expect(getServiceDeleteImpactForActor(specialist, 1))
      .rejects.toEqual(new ServiceCatalogError('FORBIDDEN'));
  });
  it('reports the transactionally rechecked impact when delete is blocked', async () => {
    const impact = {
      serviceId: 1, appointmentCount: 1, appointmentGroupCount: 0, publicPageCount: 0, canDelete: false,
    };
    repository.deleteService.mockResolvedValue({ status: 'in_use', impact });

    await expect(deleteServiceForActor(owner, 1)).rejects.toEqual(new ServiceCatalogError('SERVICE_IN_USE', {
      appointments: 1, appointmentGroups: 0, publicPages: 0,
    }));
    expect(repository.deleteService).toHaveBeenCalledWith(2, 1);
  });
});
