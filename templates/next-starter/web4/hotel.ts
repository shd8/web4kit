import { localClock } from "@web4kit/context";

/** Casa Ribeira: a boutique hotel on the Ribeira waterfront, Porto. */
export const HOTEL = {
  name: "Casa Ribeira",
  address: "Cais da Ribeira 34, 4050-510 Porto",
  neighbourhood: "Ribeira · 3 min walk to the Dom Luís I bridge",
  phone: "+351 220 123 456",
  location: { lat: 41.1406, lng: -8.613 },
  timezone: "Europe/Lisbon",
  checkIn: "15:00",
  checkOut: "11:00",
  breakfastUntil: "10:30",
};

/**
 * Demo bookings, resolved from the `?booking=` code in a confirmation email.
 * Only the dates reach web4 (as first-party facts); names and emails never do.
 */
export const BOOKINGS: Record<string, { arrival: string; nights: number }> = {
  "CR-1042": { arrival: "2026-10-02", nights: 3 },
  "CR-2077": { arrival: "2026-09-28", nights: 5 },
};

/** Deterministic demo forecast (replace with a real weather source). */
export function forecastFor(date: Date): {
  sky: "sunny" | "rainy" | "mild";
  text: string;
  tempC: number;
} {
  const day = Math.floor(date.getTime() / 86_400_000);
  const pattern = [
    { sky: "sunny", text: "Sunny", tempC: 24 },
    { sky: "mild", text: "Soft clouds over the river", tempC: 21 },
    { sky: "rainy", text: "Showers until the evening", tempC: 18 },
    { sky: "sunny", text: "Clear and warm", tempC: 26 },
  ] as const;
  return pattern[((day % 4) + 4) % 4]!;
}

export function hotelClock(date: Date) {
  return localClock(date, HOTEL.timezone);
}

/** Days between two calendar dates in the hotel's time zone (b - a). */
export function daysBetween(a: Date, isoDate: string): number {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: HOTEL.timezone }).format(a); // YYYY-MM-DD
  return Math.round((Date.parse(isoDate) - Date.parse(local)) / 86_400_000);
}
