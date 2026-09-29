import { localClock, type OpeningInterval, openState, type VenueConfig } from "@web4/context";

export const VENUE = {
  name: "Casa Lumbre",
  address: "Calle de Lavapiés 12, 28012 Madrid",
  neighbourhood: "Lavapiés · 4 min from Tirso de Molina metro",
  phone: "+34 910 234 567",
  location: { lat: 40.4086, lng: -3.7009 },
  timezone: "Europe/Madrid",
};

const D = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;

/** Tuesday to Sunday; lunch 13:00-16:00, dinner 20:00-23:30 (Fri/Sat until 00:30). Closed Monday. */
export const HOURS: OpeningInterval[] = [D.tue, D.wed, D.thu, D.fri, D.sat, D.sun].flatMap(
  (day) => [
    { day, open: "13:00", close: "16:00" },
    { day, open: "20:00", close: day === D.fri || day === D.sat ? "00:30" : "23:30" },
  ],
);

export const venueConfig: VenueConfig = {
  location: VENUE.location,
  timezone: VENUE.timezone,
  hours: HOURS,
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hoursFor(day: number): string {
  const intervals = HOURS.filter((h) => h.day === day);
  return intervals.length ? intervals.map((h) => `${h.open}–${h.close}`).join(" · ") : "Closed";
}

/** Next opening after `now`, as "today at 20:00" / "tomorrow at 13:00" / "Tuesday at 13:00". */
function nextOpening(now: Date): string {
  const clock = localClock(now, VENUE.timezone);
  for (let offset = 0; offset < 8; offset++) {
    const day = (clock.day + offset) % 7;
    const opens = HOURS.filter((h) => h.day === day)
      .map((h) => h.open)
      .sort();
    for (const open of opens) {
      const [hh, mm] = open.split(":").map(Number);
      const minutes = (hh ?? 0) * 60 + (mm ?? 0);
      if (offset > 0 || minutes > clock.minutes) {
        const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : DAY_LABELS[day];
        return `${when} at ${open}`;
      }
    }
  }
  return "soon";
}

function closingTime(now: Date): string | undefined {
  const clock = localClock(now, VENUE.timezone);
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  for (const h of HOURS) {
    for (const [day, base] of [
      [clock.day, 0],
      [(clock.day + 6) % 7, -1440],
    ] as const) {
      if (h.day !== day) continue;
      const start = toMin(h.open) + base;
      let end = toMin(h.close) + base;
      if (end <= start) end += 1440;
      if (clock.minutes >= start && clock.minutes < end) return h.close;
    }
  }
  return undefined;
}

/** Canonical schedule data, computed at render time from the real clock. */
export function scheduleData(now: Date) {
  const clock = localClock(now, VENUE.timezone);
  const status = openState(clock, HOURS, 45);
  const statusText =
    status === "closed"
      ? `Closed · opens ${nextOpening(now)}`
      : status === "closing-soon"
        ? `Closing soon · last orders before ${closingTime(now)}`
        : `Open now · until ${closingTime(now)}`;
  const order = [1, 2, 3, 4, 5, 6, 0];
  return {
    status,
    statusText,
    days: order.map((day) => ({
      label: DAY_LABELS[day]!,
      hours: hoursFor(day),
      today: day === clock.day,
    })),
  };
}
