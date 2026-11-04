import 'server-only';
import { cookies } from 'next/headers';
import { CITY_COOKIE, DEFAULT_CITY, isCity, type CityName } from '@/data/cities';

/** The city the visitor chose: `?city=` first, then their saved choice, then Cape Town. */
export async function getCity(param?: string): Promise<CityName> {
  if (isCity(param)) return param;
  const saved = (await cookies()).get(CITY_COOKIE)?.value;
  return isCity(saved) ? saved : DEFAULT_CITY;
}
