import type { ContextEnvelope, DeviceClass } from "@web4kit/context";
import { setArrival, setDistance } from "@web4kit/demo-controls";
import { PERSONAS } from "../../../../templates/hotel/web4/fixtures";
import { HOTEL } from "../../../../templates/hotel/web4/hotel";
import { situationOf } from "../../../../templates/hotel/web4/situation";
import { BASE_ENVELOPE, DEMO_DAYS, type Grid, localInstant, timeOptions } from "../grid";

const DISTANCE_KM = { nearby: 1.5, local: 25, tourist: 1500 } as const;
const NIGHTS = 3;
const persona = (name: string) => PERSONAS.find((p) => p.name === name)!.envelope;

/** Booking dates for a stay phase relative to the selected day (the site resolves them itself). */
function stayFirstParty(stay: string, day: string): Record<string, string> | undefined {
  const offset = { upcoming: 3, "arriving-today": 0, "in-house": -1, "checked-out": -(NIGHTS + 1) }[
    stay
  ];
  if (offset === undefined) return undefined; // researching: no booking
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return { arrival: d.toISOString().slice(0, 10), nights: String(NIGHTS) };
}

/** Casa Ribeira (templates/hotel): stay phase, day part, the date's weather and distance. */
export const hotel: Grid = {
  site: "hotel",
  title: "Casa Ribeira · hotel",
  controls: [
    { id: "day", label: "Day", options: DEMO_DAYS },
    { id: "time", label: "Time", options: timeOptions(60, ["08:30", "20:30"]) },
    {
      id: "stay",
      label: "Stay",
      options: [
        { value: "researching", label: "No booking" },
        { value: "upcoming", label: "Booked, arriving in 3 days" },
        { value: "arriving-today", label: "Arriving today" },
        { value: "in-house", label: "Staying" },
        { value: "checked-out", label: "Checked out" },
      ],
    },
    {
      id: "arrival",
      label: "Arrival",
      options: [
        { value: "instagram", label: "Instagram" },
        { value: "booking", label: "Booking.com" },
        { value: "maps", label: "Google Maps" },
        { value: "direct", label: "Direct" },
      ],
    },
    {
      id: "device",
      label: "Device",
      options: [
        { value: "mobile", label: "Phone" },
        { value: "tablet", label: "Tablet" },
        { value: "desktop", label: "Desktop" },
      ],
    },
    {
      id: "distance",
      label: "Distance",
      options: [
        { value: "nearby", label: "In Porto (1.5 km)" },
        { value: "local", label: "In the region (25 km)" },
        { value: "tourist", label: "Abroad (1,500 km)" },
      ],
    },
  ],
  personas: [
    {
      name: "dreamer-instagram",
      title: "Dreaming · from Instagram · evening",
      values: {
        day: "2026-10-02",
        time: "20:30",
        stay: "researching",
        arrival: "instagram",
        device: "mobile",
        distance: "tourist",
      },
      envelope: persona("dreamer-instagram"),
    },
    {
      name: "comparing-booking",
      title: "Comparing · from Booking.com · desktop",
      values: {
        day: "2026-10-02",
        time: "11:00",
        stay: "researching",
        arrival: "booking",
        device: "desktop",
        distance: "tourist",
      },
      envelope: persona("comparing-booking"),
    },
    {
      name: "arriving-today",
      title: "Arriving today · 13:00 · nearby",
      values: {
        day: "2026-10-02",
        time: "13:00",
        stay: "arriving-today",
        arrival: "direct",
        device: "mobile",
        distance: "nearby",
      },
      envelope: persona("arriving-today"),
    },
    {
      name: "in-house-morning",
      title: "Staying · day 2 · 08:30",
      values: {
        day: "2026-10-02",
        time: "08:30",
        stay: "in-house",
        arrival: "direct",
        device: "mobile",
        distance: "nearby",
      },
      envelope: persona("in-house-morning"),
    },
    {
      name: "in-house-rainy-evening",
      title: "Staying · rainy evening · 20:00",
      values: {
        day: "2026-10-04",
        time: "20:00",
        stay: "in-house",
        arrival: "direct",
        device: "mobile",
        distance: "nearby",
      },
      envelope: persona("in-house-rainy-evening"),
    },
  ],
  envelope(v) {
    const firstParty = stayFirstParty(v.stay!, v.day!);
    let e: ContextEnvelope = {
      ...BASE_ENVELOPE,
      device: v.device as DeviceClass,
      now: localInstant(v.day!, v.time!, HOTEL.timezone),
      ...(firstParty ? { firstParty } : {}),
    };
    e =
      v.arrival === "booking"
        ? { ...e, referrer: "https://www.booking.com/hotel/pt/casa-ribeira.html" }
        : setArrival(e, v.arrival as "direct");
    return setDistance(e, HOTEL.location, DISTANCE_KM[v.distance as keyof typeof DISTANCE_KM]);
  },
  situationOf,
};
