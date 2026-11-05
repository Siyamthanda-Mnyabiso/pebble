const rand = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 });

/** 125000 cents -> "R1 250" */
export function formatRand(cents: number) {
  return `R${rand.format(Math.round(cents / 100))}`;
}

/**
 * What a provider keeps from a price after Pebble's commission. Mirrors the database, which rounds the
 * commission to the nearest cent. Customers always pay the price itself.
 */
export function splitPrice(priceCents: number, commissionPercent: number) {
  const commission = Math.round((priceCents * commissionPercent) / 100);
  return { commission, earning: priceCents - commission };
}
