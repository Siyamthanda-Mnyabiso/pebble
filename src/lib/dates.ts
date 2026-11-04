const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Formats an ISO date (2026-11-06) as "Fri, 6 Nov", or "Fri, 6 Nov 2026" with `year`. */
export function formatDay(iso: string, { year = false } = {}) {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${months[m - 1]}${year ? ` ${y}` : ''}`;
}
