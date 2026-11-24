import { beforeEach, describe, expect, it, vi } from 'vitest';

const feedRepo = vi.hoisted(() => ({ listCalendarFeedAppointments: vi.fn() }));
const specialistRepo = vi.hoisted(() => ({ findSpecialistByWebUserId: vi.fn() }));
const integrationRepo = vi.hoisted(() => ({
  clearCalendarFeedToken: vi.fn(),
  findCalendarFeedOwnerByTokenHash: vi.fn(),
  setCalendarFeedTokenHash: vi.fn(),
}));

vi.mock('../src/repositories/calendarFeedRepository.js', () => feedRepo);
vi.mock('../src/repositories/specialistRepository.js', () => specialistRepo);
vi.mock('../src/repositories/webUserIntegrationRepository.js', () => integrationRepo);
vi.mock('../src/config/env.js', () => ({ env: { API_BASE_URL: 'https://api.example.test' } }));

const service = await import('../src/services/calendarFeedService.js');
const { escapeIcsText, foldIcsLine, formatIcsUtc } = await import('../src/utils/icalendar.js');
const { maskSensitivePath } = await import('../src/utils/logMasking.js');

const NOW = new Date('2026-11-01T00:00:00.000Z');
const TOKEN = 'A'.repeat(43);

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  appointment_at: new Date('2026-11-05T10:00:00.000Z'),
  duration_min: 45,
  meeting_provider: 'zoom',
  location_address: null,
  created_at: new Date('2026-10-01T08:00:00.000Z'),
  updated_at: new Date('2026-10-02T09:30:00.000Z'),
  service_name_en: 'Consult, "first"; visit',
  service_name_ru: null,
  business_address: 'Main St 1',
  meeting_link: 'https://zoom.example/secret',
  client_first_name: 'Ivan',
  client_phone: '+100',
  ...overrides,
});

describe('ICS helpers', () => {
  it('escapes RFC 5545 text', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('folds at 75 octets without splitting multi-byte characters', () => {
    const line = `SUMMARY:${'Приём '.repeat(20)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split('\r\n');
    expect(physical.length).toBeGreaterThan(1);
    for (const part of physical) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(physical.slice(1).every((part) => part.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    expect(foldIcsLine('SHORT')).toBe('SHORT');
  });

  it('formats UTC stamps', () => {
    expect(formatIcsUtc(new Date('2026-11-01T10:00:00.000Z'))).toBe('20261101T100000Z');
  });
});

describe('calendar feed service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('stores only the SHA-256 hash and returns the URL once', async () => {
    specialistRepo.findSpecialistByWebUserId.mockResolvedValue({ id: 4 });
    integrationRepo.setCalendarFeedTokenHash.mockResolvedValue(new Date('2026-11-01T00:00:00.000Z'));

    const result = await service.createOrRotateCalendarFeed(3, 7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = /calendar-feed\/(.+)\.ics$/.exec(result.feedUrl)![1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.webcalUrl).toBe(result.feedUrl.replace('https:', 'webcal:'));
    const [accountId, webUserId, hash] = integrationRepo.setCalendarFeedTokenHash.mock.calls[0];
    expect([accountId, webUserId]).toEqual([3, 7]);
    expect(hash).toBe(service.hashCalendarFeedToken(token));
    expect(hash).not.toContain(token);
  });

  it('refuses to create a feed for a web user without a specialist profile', async () => {
    specialistRepo.findSpecialistByWebUserId.mockResolvedValue(null);
    expect(await service.createOrRotateCalendarFeed(3, 7)).toEqual({ ok: false, reason: 'specialist_required' });
    expect(integrationRepo.setCalendarFeedTokenHash).not.toHaveBeenCalled();
  });

  it('returns null (constant 404) for malformed, unknown, revoked or inactive owners', async () => {
    expect(await service.renderCalendarFeed('short', NOW)).toBeNull();
    expect(integrationRepo.findCalendarFeedOwnerByTokenHash).not.toHaveBeenCalled();

    integrationRepo.findCalendarFeedOwnerByTokenHash.mockResolvedValue(null);
    expect(await service.renderCalendarFeed(TOKEN, NOW)).toBeNull();
    expect(feedRepo.listCalendarFeedAppointments).not.toHaveBeenCalled();
  });

  it('scopes the query to the token owner and the 30d/180d window', async () => {
    integrationRepo.findCalendarFeedOwnerByTokenHash.mockResolvedValue({ accountId: 3, webUserId: 7, specialistId: 4, timezone: 'UTC' });
    feedRepo.listCalendarFeedAppointments.mockResolvedValue([]);

    await service.renderCalendarFeed(TOKEN, NOW);

    expect(integrationRepo.findCalendarFeedOwnerByTokenHash).toHaveBeenCalledWith(service.hashCalendarFeedToken(TOKEN));
    expect(feedRepo.listCalendarFeedAppointments).toHaveBeenCalledWith({
      accountId: 3,
      specialistId: 4,
      from: new Date('2026-10-02T00:00:00.000Z'),
      to: new Date('2027-04-30T00:00:00.000Z'),
    });
  });

  it('renders privacy-minimised VEVENTs without meeting link or client data', async () => {
    integrationRepo.findCalendarFeedOwnerByTokenHash.mockResolvedValue({ accountId: 3, webUserId: 7, specialistId: 4, timezone: 'UTC' });
    feedRepo.listCalendarFeedAppointments.mockResolvedValue([row(), row({ id: 13, meeting_provider: 'offline', service_name_en: null, service_name_ru: 'Приём' })]);

    const ics = (await service.renderCalendarFeed(TOKEN, NOW))!;

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:appointment-12@api.example.test');
    expect(ics).toContain('DTSTART:20261105T100000Z');
    expect(ics).toContain('DTEND:20261105T104500Z');
    expect(ics).toContain('LAST-MODIFIED:20261002T093000Z');
    expect(ics).toContain('DTSTAMP:20261002T093000Z');
    expect(ics).toMatch(/SEQUENCE:\d+/);
    expect(ics).toContain('SUMMARY:Consult\\, "first"\\; visit');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT15M');
    expect(ics).toContain('X-PUBLISHED-TTL:PT15M');
    // Offline visits fall back to the business address; online ones have no location.
    expect(ics.match(/LOCATION:Main St 1/g)).toHaveLength(1);
    for (const secret of ['zoom.example', 'Ivan', '+100', 'ATTENDEE', 'DESCRIPTION', 'URL:']) {
      expect(ics).not.toContain(secret);
    }
    // Every physical line respects the 75 octet limit.
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('masks the token in logged paths', () => {
    expect(maskSensitivePath(`/api/integrations/calendar-feed/${TOKEN}.ics`)).toBe('/api/integrations/calendar-feed/:token');
  });
});
