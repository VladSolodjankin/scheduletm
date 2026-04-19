import { getAppSettings } from '../repositories/app-settings.repository';

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

export async function getNextAvailableDates(accountId: number, count = 7): Promise<string[]> {
  const results: string[] = [];
  const now = new Date();
  const settings = await getAppSettings(accountId);
  const allowedWorkDays = parseWorkDays(settings.workDays);

  for (let i = 0; results.length < count && i < 21; i += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);

    const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

    if (!allowedWorkDays.has(day)) continue;

    const formatted = formatDate(date);
    results.push(formatted);
  }

  return results;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
