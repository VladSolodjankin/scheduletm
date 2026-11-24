import { z } from 'zod';

export const PUBLIC_PAGE_ANALYTICS_PERIODS = [7, 30, 90] as const;
export type PublicPageAnalyticsPeriod = (typeof PUBLIC_PAGE_ANALYTICS_PERIODS)[number];

/** What a visitor's browser reports: a view of the page, or a click on a block. The server derives everything else. */
export const publicPageEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('view'), referrer: z.string().max(2048) }).strict(),
  z.object({ type: z.literal('click'), blockId: z.string().min(1).max(128) }).strict(),
]);
export type PublicPageEvent = z.infer<typeof publicPageEventSchema>;

export type PublicPageAnalytics = {
  days: PublicPageAnalyticsPeriod;
  totals: { views: number; clicks: number };
  daily: { date: string; views: number; clicks: number }[];
  blocks: { blockId: string; clicks: number }[];
  sources: { source: string; views: number }[];
};
