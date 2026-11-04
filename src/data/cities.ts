/** Cities Pebble covers. Customers pick one, or we find the nearest from their location. */
export const CITIES = [
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
  { name: 'Pretoria', lat: -25.7479, lng: 28.2293 },
  { name: 'Durban', lat: -29.8587, lng: 31.0218 },
  { name: 'Gqeberha', lat: -33.9608, lng: 25.6022 },
  { name: 'Bloemfontein', lat: -29.0852, lng: 26.1596 },
  { name: 'East London', lat: -33.0153, lng: 27.9116 },
  { name: 'Pietermaritzburg', lat: -29.6006, lng: 30.3794 },
  { name: 'Stellenbosch', lat: -33.9321, lng: 18.8602 },
  { name: 'George', lat: -33.963, lng: 22.4617 },
  { name: 'Polokwane', lat: -23.9045, lng: 29.4689 },
  { name: 'Mbombela', lat: -25.4753, lng: 30.9694 },
  { name: 'Kimberley', lat: -28.7282, lng: 24.7499 },
  { name: 'Rustenburg', lat: -25.6676, lng: 27.2421 },
] as const;

export type CityName = (typeof CITIES)[number]['name'];

export const CITY_NAMES: string[] = CITIES.map((c) => c.name);
export const DEFAULT_CITY: CityName = 'Cape Town';
export const CITY_COOKIE = 'pebble_city';

export function isCity(value: string | undefined | null): value is CityName {
  return !!value && CITY_NAMES.includes(value);
}

/** The covered city closest to a point (straight-line distance is plenty here). */
export function nearestCity(lat: number, lng: number) {
  const rad = Math.PI / 180;
  let best: { name: CityName; km: number } = { name: DEFAULT_CITY, km: Infinity };
  for (const c of CITIES) {
    const dLat = (c.lat - lat) * rad;
    const dLng = (c.lng - lng) * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * rad) * Math.cos(c.lat * rad) * Math.sin(dLng / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(a));
    if (km < best.km) best = { name: c.name, km };
  }
  return best;
}
