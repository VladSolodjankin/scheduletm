export function getNextAvailableDates(count = 7): string[] {
  const results: string[] = [];
  const now = new Date();

  for (let i = 0; results.length < count && i < 21; i += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);

    const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const isWorkingDay = day >= 1 && day <= 6;

    if (!isWorkingDay) continue;

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
