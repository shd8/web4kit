import type { ContextEnvelope, DeviceClass } from "@web4kit/context";
import { setArrival, setDistance, setVisits } from "@web4kit/demo-controls";
import { CORE_FIXTURES, situationOf, VENUE } from "@web4kit/example-restaurant";
import { BASE_ENVELOPE, DEMO_DAYS, type Grid, localInstant, timeOptions } from "../grid";

const DISTANCE_KM = { nearby: 1, local: 10, tourist: 900 } as const;
const fixture = (name: string) => CORE_FIXTURES.find((f) => f.name === name)!.envelope;

/** Casa Lumbre (examples/restaurant): the venue's hours make day and time matter. */
export const restaurant: Grid = {
  site: "restaurant",
  title: "Casa Lumbre · restaurant",
  controls: [
    { id: "day", label: "Day", options: DEMO_DAYS },
    { id: "time", label: "Time", options: timeOptions(30, ["13:10", "23:40"]) },
    {
      id: "arrival",
      label: "Arrival",
      options: [
        { value: "instagram", label: "Instagram" },
        { value: "maps", label: "Google Maps" },
        { value: "tripadvisor", label: "Tripadvisor" },
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
        { value: "nearby", label: "Around the corner (1 km)" },
        { value: "local", label: "Across town (10 km)" },
        { value: "tourist", label: "Another country (900 km)" },
      ],
    },
    {
      id: "language",
      label: "Language",
      options: [
        { value: "en-GB", label: "English" },
        { value: "es-ES", label: "Spanish" },
      ],
    },
    {
      id: "visits",
      label: "Visits",
      options: [
        { value: "none", label: "First time (no cookie)" },
        { value: "regular", label: "Regular" },
      ],
    },
  ],
  personas: [
    {
      name: "tourist-insta",
      title: "Tourist · from Instagram · 20:30",
      values: {
        day: "2026-09-29",
        time: "20:30",
        arrival: "instagram",
        device: "mobile",
        distance: "tourist",
        language: "en-GB",
        visits: "none",
      },
      envelope: fixture("tourist-insta"),
    },
    {
      name: "local-maps",
      title: "Nearby · from Google Maps · 13:10",
      values: {
        day: "2026-09-29",
        time: "13:10",
        arrival: "maps",
        device: "mobile",
        distance: "nearby",
        language: "es-ES",
        visits: "none",
      },
      envelope: fixture("local-maps"),
    },
    {
      name: "regular-desktop",
      title: "Regular · desktop · lunchtime",
      values: {
        day: "2026-09-30",
        time: "13:30",
        arrival: "direct",
        device: "desktop",
        distance: "local",
        language: "es-ES",
        visits: "regular",
      },
      envelope: fixture("regular-desktop"),
    },
    {
      name: "late-night-closed",
      title: "Late night · closed · 23:40",
      values: {
        day: "2026-09-29",
        time: "23:40",
        arrival: "direct",
        device: "mobile",
        distance: "nearby",
        language: "en-GB",
        visits: "none",
      },
      envelope: fixture("late-night-closed"),
    },
  ],
  envelope(v) {
    let e: ContextEnvelope = {
      ...BASE_ENVELOPE,
      languages: [v.language!],
      device: v.device as DeviceClass,
      now: localInstant(v.day!, v.time!, VENUE.timezone),
    };
    e = setArrival(e, v.arrival as "direct");
    e = setDistance(e, VENUE.location, DISTANCE_KM[v.distance as keyof typeof DISTANCE_KM]);
    return setVisits(e, v.visits as "none");
  },
  situationOf,
};
