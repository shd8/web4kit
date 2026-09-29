/**
 * Meridian Supply: a small operational graph (suppliers -> warehouses -> regions) with orders,
 * shipments and products. Fully synthetic and deterministic.
 */
export const SUPPLIERS = [
  { id: "s-atlas", name: "Atlas Components", country: "DE", onTime: 0.97, open: 42 },
  { id: "s-borealis", name: "Borealis Metals", country: "SE", onTime: 0.71, open: 18 },
  { id: "s-cobalt", name: "Cobalt Plastics", country: "PL", onTime: 0.88, open: 33 },
  { id: "s-delta", name: "Delta Textiles", country: "PT", onTime: 0.64, open: 27 },
  { id: "s-ember", name: "Ember Electronics", country: "TW", onTime: 0.93, open: 51 },
  { id: "s-fjord", name: "Fjord Packaging", country: "NO", onTime: 0.99, open: 12 },
  { id: "s-granite", name: "Granite Tools", country: "ES", onTime: 0.82, open: 21 },
];

export const WAREHOUSES = [
  { id: "w-rotterdam", name: "Rotterdam DC", status: "ok" as const },
  { id: "w-madrid", name: "Madrid DC", status: "warn" as const },
  { id: "w-milan", name: "Milan DC", status: "ok" as const },
];

export const LANES = [
  ["s-atlas", "w-rotterdam"],
  ["s-borealis", "w-rotterdam"],
  ["s-cobalt", "w-milan"],
  ["s-delta", "w-madrid"],
  ["s-ember", "w-rotterdam"],
  ["s-ember", "w-milan"],
  ["s-fjord", "w-rotterdam"],
  ["s-granite", "w-madrid"],
] as const;

export const SHIPMENTS = [
  {
    id: "SH-20931",
    supplier: "Borealis Metals",
    lane: "Luleå → Rotterdam",
    eta: "Oct 2",
    delayDays: 6,
  },
  {
    id: "SH-20944",
    supplier: "Delta Textiles",
    lane: "Porto → Madrid",
    eta: "Oct 1",
    delayDays: 4,
  },
  {
    id: "SH-20952",
    supplier: "Delta Textiles",
    lane: "Porto → Madrid",
    eta: "Oct 3",
    delayDays: 3,
  },
  {
    id: "SH-20967",
    supplier: "Granite Tools",
    lane: "Bilbao → Madrid",
    eta: "Sep 30",
    delayDays: 2,
  },
  {
    id: "SH-20971",
    supplier: "Borealis Metals",
    lane: "Luleå → Rotterdam",
    eta: "Oct 5",
    delayDays: 1,
  },
  { id: "SH-20988", supplier: "Cobalt Plastics", lane: "Łódź → Milan", eta: "Oct 2", delayDays: 1 },
];

export const PRODUCTS = [
  { sku: "MX-100", name: "Servo housing", units: 12_400, revenue: "€1.24M", cover: 21 },
  { sku: "MX-220", name: "Copper busbar", units: 8_150, revenue: "€0.97M", cover: 6 },
  { sku: "TX-310", name: "Technical fabric roll", units: 5_300, revenue: "€0.61M", cover: 4 },
  { sku: "PK-050", name: "Moulded tray", units: 22_900, revenue: "€0.46M", cover: 34 },
  { sku: "EL-777", name: "Controller board", units: 3_870, revenue: "€1.88M", cover: 11 },
  { sku: "TL-404", name: "Torque wrench kit", units: 1_960, revenue: "€0.29M", cover: 9 },
];

const weeks = Array.from({ length: 12 }, (_, i) => `W${29 + i}`);
const wave = (base: number, amp: number, phase: number, drift = 0) =>
  weeks.map((t, i) => ({
    t,
    v: Math.round((base + amp * Math.sin(i / 1.7 + phase) + drift * i) * 10) / 10,
  }));

export const ON_TIME_TREND = {
  unit: "% on time",
  series: [
    { label: "North", points: wave(93, 2.5, 0.2, 0.1) },
    { label: "Iberia", points: wave(86, 4, 1.4, -0.9) },
    { label: "Central", points: wave(90, 3, 2.3, 0) },
  ],
};

export const ORDER_VOLUME = {
  unit: "orders / week",
  series: [
    { label: "2026", points: wave(410, 45, 0.5, 6) },
    { label: "2025", points: wave(380, 40, 0.9, 2) },
  ],
};

export const MARGINS = SUPPLIERS.map((s, i) => ({
  name: s.name,
  margin: `${(18 + ((i * 7) % 11)).toFixed(0)}%`,
  trend: i % 3 === 0 ? "Watch" : "OK",
}));

export const BRIEFING = {
  title: "Iberia lanes are slipping",
  body: "On-time delivery into Madrid fell for the fourth week running. Delta Textiles and Granite Tools account for most delays; fabric cover is down to four days.",
};
