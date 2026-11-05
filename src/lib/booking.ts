/** Start times a provider can be booked for. */
export const BOOKING_TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00'];

/** The start times a day is bookable for: from the first to the last, skipping the break. */
export function timesFor(first: string, last: string, skip: string) {
  return BOOKING_TIMES.filter((t) => t >= first && t <= last && t !== skip);
}

/** Reads a day's saved start times back into a first, last and break. */
export function describeTimes(times: string[]) {
  if (times.length === 0)
    return { on: false, first: BOOKING_TIMES[0], last: BOOKING_TIMES[4], skip: '' };
  const first = times[0];
  const last = times[times.length - 1];
  const skip =
    BOOKING_TIMES.find((t) => t > first && t < last && !times.includes(t)) ?? '';
  return { on: true, first, last, skip };
}
