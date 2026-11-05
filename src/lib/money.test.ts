import { describe, expect, it } from 'vitest';
import { formatRand, splitPrice } from './money';

describe('splitPrice', () => {
  it('takes the commission from the provider, never from the customer', () => {
    // R300 at 10%: the customer pays R300, the provider keeps R270.
    expect(splitPrice(30000, 10)).toEqual({ commission: 3000, earning: 27000 });
  });

  it('always adds back up to the price', () => {
    for (const price of [100, 333, 12345, 99999]) {
      for (const pct of [0, 7.5, 10, 12.5, 50]) {
        const { commission, earning } = splitPrice(price, pct);
        expect(commission + earning).toBe(price);
        expect(earning).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rounds the commission to the nearest cent, like the database', () => {
    expect(splitPrice(333, 10).commission).toBe(33);
    expect(splitPrice(335, 10).commission).toBe(34);
  });

  it('charges nothing at 0%', () => {
    expect(splitPrice(45000, 0)).toEqual({ commission: 0, earning: 45000 });
  });
});

describe('formatRand', () => {
  it('shows whole rand', () => {
    expect(formatRand(45000)).toMatch(/^R450$/);
  });
});
