import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { listCalendarFeedAppointments } from '../repositories/calendarFeedRepository.js';
import { findSpecialistByWebUserId } from '../repositories/specialistRepository.js';
import {
  clearCalendarFeedToken,
  findCalendarFeedOwnerByTokenHash,
  setCalendarFeedTokenHash,
} from '../repositories/webUserIntegrationRepository.js';
import { buildIcsCalendar, type IcsEvent } from '../utils/icalendar.js';

const FEED_PAST_DAYS = 30;
const FEED_FUTURE_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 32 random bytes as base64url. */
const FEED_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashCalendarFeedToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedCalendarFeedToken(token: string): boolean {
  return FEED_TOKEN_PATTERN.test(token);
}

function buildFeedUrls(token: string) {
  const feedUrl = `${env.API_BASE_URL.replace(/\/+$/, '')}/api/integrations/calendar-feed/${token}.ics`;
  return { feedUrl, webcalUrl: feedUrl.replace(/^https?:/, 'webcal:') };
}

/** Creates or rotates the feed token. The full URL is returned only here; only its SHA-256 is stored. */
export async function createOrRotateCalendarFeed(accountId: number, webUserId: number) {
  const specialist = await findSpecialistByWebUserId(accountId, webUserId);
  if (!specialist) {
    return { ok: false as const, reason: 'specialist_required' as const };
  }

  const token = randomBytes(32).toString('base64url');
  const createdAt = await setCalendarFeedTokenHash(accountId, webUserId, hashCalendarFeedToken(token));
  return { ok: true as const, createdAt: createdAt.toISOString(), ...buildFeedUrls(token) };
}

export async function revokeCalendarFeed(accountId: number, webUserId: number): Promise<void> {
  await clearCalendarFeedToken(accountId, webUserId);
}

function feedHost(): string {
  try {
    return new URL(env.API_BASE_URL).host;
  } catch {
    return 'localhost';
  }
}

/** Returns the ICS document for a token, or null for unknown/revoked tokens and inactive owners (one constant 404). */
export async function renderCalendarFeed(token: string, now = new Date()): Promise<string | null> {
  if (!isWellFormedCalendarFeedToken(token)) {
    return null;
  }
  const owner = await findCalendarFeedOwnerByTokenHash(hashCalendarFeedToken(token));
  if (!owner) {
    return null;
  }

  const appointments = await listCalendarFeedAppointments({
    accountId: owner.accountId,
    specialistId: owner.specialistId,
    from: new Date(now.getTime() - FEED_PAST_DAYS * DAY_MS),
    to: new Date(now.getTime() + FEED_FUTURE_DAYS * DAY_MS),
  });

  const host = feedHost();
  const events: IcsEvent[] = appointments.map((appointment) => {
    const start = new Date(appointment.appointment_at);
    const modified = new Date(appointment.updated_at ?? appointment.created_at);
    const location = appointment.location_address?.trim()
      || (appointment.meeting_provider === 'offline' ? appointment.business_address?.trim() : '')
      || undefined;
    return {
      uid: `appointment-${appointment.id}@${host}`,
      // DTSTAMP tracks the last change (not "now") so the document, and its ETag, are stable between changes.
      stamp: modified,
      start,
      end: new Date(start.getTime() + appointment.duration_min * 60_000),
      lastModified: modified,
      // Minutes since epoch: monotonically increases with every update of the appointment.
      sequence: Math.floor(modified.getTime() / 60_000),
      summary: appointment.service_name_en?.trim() || appointment.service_name_ru?.trim() || 'Appointment',
      ...(location ? { location } : {}),
    };
  });

  return buildIcsCalendar({ name: 'Appointments', prodId: '-//Meetli//Appointments Feed//EN', events });
}
