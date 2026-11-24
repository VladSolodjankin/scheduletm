import type { PublicPageAnalytics, PublicPageAnalyticsPeriod } from '@scheduletm/shared/public-page-analytics';
import { db } from '../db/knex.js';

export async function insertPublicPageEvent(event: {
  pageId: string;
  type: 'view' | 'click';
  blockId: string | null;
  source: string | null;
}): Promise<void> {
  await db('public_page_events').insert({
    page_id: event.pageId, type: event.type, block_id: event.blockId, source: event.source,
  });
}

const countOf = (value: unknown) => Number(value);

export async function readPublicPageAnalytics(
  pageId: string,
  days: PublicPageAnalyticsPeriod,
  timezone: string,
): Promise<PublicPageAnalytics> {
  const since = db.raw(`(date_trunc('day', now() AT TIME ZONE ?) - ?::int * interval '1 day') AT TIME ZONE ?`, [timezone, days - 1, timezone]);
  const events = () => db('public_page_events').where('page_id', pageId).where('created_at', '>=', since);
  const [totals, daily, blocks, sources] = await Promise.all([
    events().select('type').count('* as count').groupBy('type'),
    events().select(db.raw(`to_char(created_at AT TIME ZONE ?, 'YYYY-MM-DD') as date`, [timezone]), 'type')
      .count('* as count').groupBy('date', 'type'),
    events().where('type', 'click').whereNotNull('block_id').select('block_id').count('* as count')
      .groupBy('block_id').orderBy('count', 'desc').limit(10),
    events().where('type', 'view').select('source').count('* as count').groupBy('source').orderBy('count', 'desc').limit(10),
  ]);
  const totalOf = (type: string) => countOf(totals.find((row) => row.type === type)?.count ?? 0);
  const dayRows = new Map<string, { views: number; clicks: number }>();
  for (const row of daily) {
    const entry = dayRows.get(String(row.date)) ?? { views: 0, clicks: 0 };
    entry[row.type === 'view' ? 'views' : 'clicks'] = countOf(row.count);
    dayRows.set(String(row.date), entry);
  }
  const today = await db.raw<{ rows: { date: string }[] }>(
    `select to_char(d, 'YYYY-MM-DD') as date from generate_series(
      (now() AT TIME ZONE ?)::date - ?::int, (now() AT TIME ZONE ?)::date, interval '1 day') d`,
    [timezone, days - 1, timezone],
  );
  return {
    days,
    totals: { views: totalOf('view'), clicks: totalOf('click') },
    daily: today.rows.map(({ date }) => ({ date, views: dayRows.get(date)?.views ?? 0, clicks: dayRows.get(date)?.clicks ?? 0 })),
    blocks: blocks.map((row) => ({ blockId: String(row.block_id), clicks: countOf(row.count) })),
    sources: sources.map((row) => ({ source: String(row.source ?? ''), views: countOf(row.count) })),
  };
}
