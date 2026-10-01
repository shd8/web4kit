import type { ContextEnvelope, DeviceClass } from "@web4kit/context";
import { setArrival } from "@web4kit/demo-controls";
import { PERSONAS } from "../../../../templates/welcome/web4/personas";
import { situationOf } from "../../../../templates/welcome/web4/situation";
import { BASE_ENVELOPE, type Grid, localInstant, timeOptions } from "../grid";

const TIMEZONE = "Europe/Madrid";
const DAY = "2026-10-02";
const persona = (name: string) => PERSONAS.find((p) => p.name === name)!.envelope;

/** The welcome starter (templates/welcome): the visitor's day part, arrival and device. */
export const welcome: Grid = {
  site: "welcome",
  title: "Welcome starter",
  controls: [
    { id: "time", label: "Time", options: timeOptions(60, ["01:30", "20:30"]) },
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
  ],
  personas: [
    {
      name: "first-visit",
      title: "First visit · desktop · afternoon",
      values: { time: "16:00", arrival: "direct", device: "desktop" },
      envelope: persona("first-visit"),
    },
    {
      name: "from-instagram",
      title: "From Instagram · phone · evening",
      values: { time: "20:30", arrival: "instagram", device: "mobile" },
      envelope: persona("from-instagram"),
    },
    {
      name: "night-owl",
      title: "Night owl · desktop · 01:30",
      values: { time: "01:30", arrival: "direct", device: "desktop" },
      envelope: persona("night-owl"),
    },
  ],
  envelope(v) {
    const e: ContextEnvelope = {
      ...BASE_ENVELOPE,
      device: v.device as DeviceClass,
      timezone: TIMEZONE,
      now: localInstant(DAY, v.time!, TIMEZONE),
    };
    return setArrival(e, v.arrival as "direct");
  },
  situationOf,
};
