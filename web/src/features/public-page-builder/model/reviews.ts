import type { BlockContent } from '../types/publicPage';

export const MAX_REVIEWS_TITLE_LENGTH = 120;

export function normalizeReviewsContent(content: BlockContent): BlockContent {
  return {
    title: typeof content.title === 'string' ? content.title : '',
    showSummary: typeof content.showSummary === 'boolean' ? content.showSummary : true,
    autoplay: typeof content.autoplay === 'boolean' ? content.autoplay : false,
  };
}

export function validateReviewsContent(content: BlockContent): string[] {
  const title = typeof content.title === 'string' ? content.title : '';
  return title.length > MAX_REVIEWS_TITLE_LENGTH ? ['title is too long'] : [];
}
