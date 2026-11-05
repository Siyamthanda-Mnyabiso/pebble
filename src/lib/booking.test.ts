import { describe, expect, it } from 'vitest';
import { BOOKING_TIMES, describeTimes, timesFor } from './booking';

describe('working hours', () => {
  it('lists the start times from the first job to the last', () => {
    expect(timesFor('08:00', '14:00', '')).toEqual(['08:00', '10:00', '12:00', '14:00']);
  });

  it('leaves out the break', () => {
    expect(timesFor('08:00', '16:00', '12:00')).toEqual([
      '08:00',
      '10:00',
      '14:00',
      '16:00',
    ]);
  });

  it('gives nothing when the last job is before the first', () => {
    expect(timesFor('14:00', '08:00', '')).toEqual([]);
  });

  it('reads saved times back into a first, last and break', () => {
    expect(describeTimes(['08:00', '10:00', '14:00', '16:00'])).toEqual({
      on: true,
      first: '08:00',
      last: '16:00',
      skip: '12:00',
    });
  });

  it('treats a day with no times as a day off', () => {
    expect(describeTimes([]).on).toBe(false);
  });

  it('round-trips every first, last and break', () => {
    for (const first of BOOKING_TIMES) {
      for (const last of BOOKING_TIMES) {
        if (last < first) continue;
        for (const skip of ['', ...BOOKING_TIMES]) {
          const times = timesFor(first, last, skip);
          if (times.length === 0) continue;
          const back = describeTimes(times);
          expect(timesFor(back.first, back.last, back.skip)).toEqual(times);
        }
      }
    }
  });
});
