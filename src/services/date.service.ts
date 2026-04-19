import { getAppSettings } from '../repositories/app-settings.repository';
import { getCurrentDateInTimezone, getDateAfterDays } from '../utils/timezone';

function parseWorkDays(workDays: string) {
  const allowed = new Set<number>();

  for (const chunk of workDays.split(',')) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const day = Number(trimmed);
    if (Number.isInteger(day) && day >= 0 && day <= 6) {
      allowed.add(day);
    }
  }

  return allowed;
}

function getWeekDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export async function getNextAvailableDates(accountId: number, count = 7): Promise<string[]> {
  const results: string[] = [];
  const settings = await getAppSettings(accountId);
  const allowedWorkDays = parseWorkDays(settings.workDays);
  const startDate = getCurrentDateInTimezone(settings.timezone);

  for (let i = 0; results.length < count && i < 21; i += 1) {
    const date = getDateAfterDays(startDate, i);
    const day = getWeekDay(date); // 0=Sun, 1=Mon, ... 6=Sat

    if (!allowedWorkDays.has(day)) continue;

    results.push(date);
  }

  return results;
}
