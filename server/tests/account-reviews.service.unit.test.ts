import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebUserRole } from '../src/types/webUserRole.js';

const repository = vi.hoisted(() => ({
  listReviews: vi.fn(), findReview: vi.fn(), countReviews: vi.fn(),
  createReview: vi.fn(), updateReview: vi.fn(), deleteReview: vi.fn(),
}));
const mediaRepository = vi.hoisted(() => ({ findAccountMedia: vi.fn() }));
vi.mock('../src/repositories/reviewRepository.js', () => repository);
vi.mock('../src/repositories/publicPageMediaRepository.js', () => mediaRepository);
import {
  createReviewForActor,
  deleteReviewForActor,
  getPublicReviews,
  listReviewsForActor,
  ReviewError,
  updateReviewForActor,
} from '../src/services/reviewService.js';

const owner = { id: '7', accountId: 2, email: '', role: WebUserRole.Owner, passwordSalt: '', passwordHash: '', createdAt: '' };
const MEDIA = '1f2ec7e3-f737-48f7-af97-ed82f2791bc7';
const record = (patch: Record<string, unknown> = {}) => ({
  id: 1, account_id: 2, name: 'Anna', text: 'Great', rating: 5, review_date: '', screenshot_media_id: null,
  screenshot_alt: '', status: 'published', source: 'manual', created_by: 7,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
  screenshot_width: null, screenshot_height: null, ...patch,
});
const input = { name: 'Anna', text: 'Great', rating: 5, reviewDate: '', status: 'published' as const };

describe('review service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.countReviews.mockResolvedValue(0);
    repository.createReview.mockResolvedValue(1);
    repository.findReview.mockResolvedValue(record());
    mediaRepository.findAccountMedia.mockResolvedValue({ id: MEDIA });
  });

  it('scopes list, create, update and delete by the actor account', async () => {
    repository.listReviews.mockResolvedValue([record()]);
    expect((await listReviewsForActor(owner)).limit).toBe(30);
    expect(repository.listReviews).toHaveBeenCalledWith(2);
    await createReviewForActor(owner, input);
    expect(repository.createReview).toHaveBeenCalledWith(2, 7, expect.objectContaining({ name: 'Anna' }));
    await updateReviewForActor(owner, 1, { status: 'hidden' });
    expect(repository.findReview).toHaveBeenCalledWith(2, 1);
    expect(repository.updateReview).toHaveBeenCalledWith(2, 1, { status: 'hidden' });
    repository.deleteReview.mockResolvedValue(true);
    await deleteReviewForActor(owner, 1);
    expect(repository.deleteReview).toHaveBeenCalledWith(2, 1);
  });
  it('rejects the 31st review but allows the 30th', async () => {
    repository.countReviews.mockResolvedValueOnce(29);
    await expect(createReviewForActor(owner, input)).resolves.toBeTruthy();
    repository.countReviews.mockResolvedValueOnce(30);
    await expect(createReviewForActor(owner, input)).rejects.toMatchObject({ code: 'REVIEW_LIMIT_REACHED' });
  });
  it('rejects a screenshot from another account', async () => {
    mediaRepository.findAccountMedia.mockResolvedValue(null);
    await expect(createReviewForActor(owner, { ...input, screenshotMediaId: MEDIA, screenshotAlt: 'x' }))
      .rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND' });
    await expect(updateReviewForActor(owner, 1, { screenshotMediaId: MEDIA, screenshotAlt: 'x' }))
      .rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND' });
    expect(mediaRepository.findAccountMedia).toHaveBeenCalledWith(2, MEDIA);
    expect(repository.createReview).not.toHaveBeenCalled();
  });
  it('returns not found for foreign or missing reviews', async () => {
    repository.findReview.mockResolvedValue(null);
    repository.deleteReview.mockResolvedValue(false);
    await expect(updateReviewForActor(owner, 9, { status: 'hidden' })).rejects.toBeInstanceOf(ReviewError);
    await expect(deleteReviewForActor(owner, 9)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('requires alt when a patch sets a screenshot and clears alt when removing it', async () => {
    await expect(updateReviewForActor(owner, 1, { screenshotMediaId: MEDIA })).rejects.toMatchObject({ code: 'INVALID' });
    await updateReviewForActor(owner, 1, { screenshotMediaId: null });
    expect(repository.updateReview).toHaveBeenCalledWith(2, 1, { screenshot_media_id: null, screenshot_alt: '' });
  });
  it('builds public reviews with a rounded average from published rows only', async () => {
    repository.listReviews.mockResolvedValue([
      record({ id: 3, rating: 5, screenshot_media_id: MEDIA, screenshot_alt: 'Shot', screenshot_width: 10, screenshot_height: 20 }),
      record({ id: 2, rating: 4 }),
      record({ id: 1, rating: 4 }),
    ]);
    const result = await getPublicReviews(2);
    expect(repository.listReviews).toHaveBeenCalledWith(2, 'published');
    expect(result.summary).toEqual({ average: 4.3, count: 3 });
    expect(result.reviews[0]!.screenshot).toEqual({
      url: expect.stringContaining(`/api/public-pages/media/${MEDIA}/content`), alt: 'Shot', width: 10, height: 20,
    });
    expect(result.reviews[1]!.screenshot).toBeNull();
    expect(result.reviews[0]).not.toHaveProperty('status');
  });
  it('returns a null average when there are no published reviews', async () => {
    repository.listReviews.mockResolvedValue([]);
    expect(await getPublicReviews(2)).toEqual({ reviews: [], summary: { average: null, count: 0 } });
  });
});
