import type { BlockSchedule, PublicPageDocument } from '../types/publicPage';

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    formatters.set(zone, value);
  }
  return value;
}
export function isScheduleTimezone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone.trim()) {return false;}
  try {formatter(zone); return true;} catch {return false;}
}
function parts(time: number, zone: string): Record<string, string> {
  return Object.fromEntries(formatter(zone).formatToParts(time).map(({ type, value }) => [type, value]));
}
export function utcScheduleTimeToLocal(iso: string, zone: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time) || !isScheduleTimezone(zone)) {return '';}
  const p = parts(time, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function localScheduleTimeToUtc(value: string, zone: string): { value: string | null; error: 'invalid_time' | 'nonexistent_time' | 'ambiguous_time' | null } {
  const invalid = { value: null, error: 'invalid_time' } as const;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !isScheduleTimezone(zone)) {return invalid;}
  const nominal = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 16) !== value) {return invalid;}
  // Sample both sides of nearby offset transitions, then verify each candidate.
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = nominal + hours * 3_600_000;
    const p = parts(sample, zone);
    offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - sample);
  }
  const matches = [...offsets].map((offset) => nominal - offset)
    .filter((time) => utcScheduleTimeToLocal(new Date(time).toISOString(), zone) === value);
  if (!matches.length) {return { value: null, error: 'nonexistent_time' };}
  if (matches.length > 1) {return { value: null, error: 'ambiguous_time' };}
  return { value: new Date(matches[0]).toISOString(), error: null };
}
export function isBlockScheduledVisible(schedule: BlockSchedule, timezone: string, now: number = Date.now()): boolean {
  if (schedule.period && (now < Date.parse(schedule.period.startAt) || now >= Date.parse(schedule.period.endAt))) {return false;}
  if (schedule.weekdays) {
    const p = parts(now, timezone);
    const day = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay() || 7;
    if (!schedule.weekdays.includes(day)) {return false;}
  }
  return true;
}
export function nextScheduleVisibilityChange(document: PublicPageDocument, now: number = Date.now()): number | null {
  const schedules = document.sections.flatMap((section) => section.blocks.map((block) => block.schedule));
  const boundaries = schedules.flatMap((schedule) => schedule.period ? [Date.parse(schedule.period.startAt), Date.parse(schedule.period.endAt)] : []).filter((time) => time > now);
  if (schedules.some((schedule) => schedule.weekdays !== null)) {
    const dateKey = (time: number) => utcScheduleTimeToLocal(new Date(time).toISOString(), document.timezone).slice(0, 10);
    const today = dateKey(now);
    let low = now;
    let high = now + 30 * 3_600_000;
    // Find the actual local date boundary, including zones with midnight DST changes.
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (dateKey(middle) === today) {low = middle;} else {high = middle;}
    }
    boundaries.push(high);
  }
  return boundaries.length ? Math.min(...boundaries) : null;
}
