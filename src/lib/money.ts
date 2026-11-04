const rand = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 });

/** 125000 cents -> "R1 250" */
export function formatRand(cents: number) {
  return `R${rand.format(Math.round(cents / 100))}`;
}
