// Rolling schedule: the FREE bootcamp always kicks off on the next upcoming
// Monday at 7 PM IST, so the page never shows a stale, past date.
export function getNextBootcampStart(): Date {
  const now = new Date();
  const target = new Date(now);
  const day = target.getDay(); // 0 = Sun ... 6 = Sat
  let daysUntilMonday = (1 - day + 7) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // if today is Monday, roll to next week
  target.setDate(target.getDate() + daysUntilMonday);
  target.setHours(19, 0, 0, 0);
  return target;
}

export function formatBatchDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
