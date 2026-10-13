import type { User } from '../types/domain.js';
import * as repository from '../repositories/reviewRepository.js';
import { findAccountMedia } from '../repositories/publicPageMediaRepository.js';
import { publicPageMediaUrl } from '../utils/publicPageMediaUrl.js';

export const REVIEW_LIMIT = 30;

export class ReviewError extends Error {
  constructor(public code: 'FORBIDDEN' | 'NOT_FOUND' | 'MEDIA_NOT_FOUND' | 'REVIEW_LIMIT_REACHED' | 'INVALID') {
    super(code);
  }
}

type ReviewInput = {
  name?: string; text?: string; rating?: number; reviewDate?: string;
  screenshotMediaId?: string | null; screenshotAlt?: string; status?: repository.ReviewStatus;
};
type ReviewCreateInput = ReviewInput & Required<Pick<ReviewInput, 'name' | 'text' | 'rating' | 'reviewDate' | 'status'>>;

const toDto = (review: repository.ReviewRecord) => ({
  id: review.id,
  name: review.name,
  text: review.text,
  rating: review.rating,
  reviewDate: review.review_date,
  screenshot: review.screenshot_media_id ? {
    mediaId: review.screenshot_media_id,
    url: publicPageMediaUrl(review.screenshot_media_id),
    alt: review.screenshot_alt,
    width: review.screenshot_width ?? 0,
    height: review.screenshot_height ?? 0,
  } : null,
  status: review.status,
  source: review.source,
  createdAt: new Date(review.created_at).toISOString(),
  updatedAt: new Date(review.updated_at).toISOString(),
});

const toWrite = (input: ReviewInput): repository.ReviewWrite => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.text !== undefined ? { text: input.text } : {}),
  ...(input.rating !== undefined ? { rating: input.rating } : {}),
  ...(input.reviewDate !== undefined ? { review_date: input.reviewDate } : {}),
  ...(input.screenshotMediaId !== undefined ? { screenshot_media_id: input.screenshotMediaId } : {}),
  ...(input.screenshotAlt !== undefined ? { screenshot_alt: input.screenshotAlt } : {}),
  ...(input.status !== undefined ? { status: input.status } : {}),
});

async function assertMediaInAccount(accountId: number, mediaId: string | null | undefined) {
  if (mediaId && !(await findAccountMedia(accountId, mediaId))) throw new ReviewError('MEDIA_NOT_FOUND');
}

export async function listReviewsForActor(actor: User) {
  const reviews = await repository.listReviews(actor.accountId);
  return { reviews: reviews.map(toDto), limit: REVIEW_LIMIT };
}

export async function createReviewForActor(actor: User, input: ReviewCreateInput) {
  await assertMediaInAccount(actor.accountId, input.screenshotMediaId);
  if ((await repository.countReviews(actor.accountId)) >= REVIEW_LIMIT) throw new ReviewError('REVIEW_LIMIT_REACHED');
  const id = await repository.createReview(actor.accountId, Number(actor.id) || null, {
    name: input.name, text: input.text, rating: input.rating,
    review_date: input.reviewDate, status: input.status,
    screenshot_media_id: input.screenshotMediaId ?? null,
    screenshot_alt: input.screenshotMediaId ? (input.screenshotAlt ?? '') : '',
  });
  return toDto((await repository.findReview(actor.accountId, id))!);
}

export async function updateReviewForActor(actor: User, id: number, input: ReviewInput) {
  const existing = await repository.findReview(actor.accountId, id);
  if (!existing) throw new ReviewError('NOT_FOUND');
  await assertMediaInAccount(actor.accountId, input.screenshotMediaId);
  const write = toWrite(input);
  if (input.screenshotMediaId === null) write.screenshot_alt = '';
  const mediaId = write.screenshot_media_id === undefined ? existing.screenshot_media_id : write.screenshot_media_id;
  const alt = write.screenshot_alt ?? existing.screenshot_alt;
  if (mediaId && !alt) throw new ReviewError('INVALID');
  await repository.updateReview(actor.accountId, id, write);
  return toDto((await repository.findReview(actor.accountId, id))!);
}

export async function deleteReviewForActor(actor: User, id: number) {
  if (!(await repository.deleteReview(actor.accountId, id))) throw new ReviewError('NOT_FOUND');
}

export async function getPublicReviews(accountId: number) {
  const reviews = await repository.listReviews(accountId, 'published');
  const count = reviews.length;
  const average = count === 0
    ? null
    : Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / count) * 10) / 10;
  return {
    reviews: reviews.map((review) => ({
      id: review.id,
      name: review.name,
      text: review.text,
      rating: review.rating,
      reviewDate: review.review_date,
      screenshot: review.screenshot_media_id ? {
        url: publicPageMediaUrl(review.screenshot_media_id),
        alt: review.screenshot_alt,
        width: review.screenshot_width ?? 0,
        height: review.screenshot_height ?? 0,
      } : null,
    })),
    summary: { average, count },
  };
}
