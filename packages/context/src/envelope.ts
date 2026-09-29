/**
 * Tier 0 Context Envelope: everything web4 may know about a visitor from the initial request
 * alone (spec: context-envelope). The envelope never leaves the server and never enters a plan
 * or a decider; only derived situation labels do.
 */
export interface Geo {
  lat: number;
  lng: number;
  country?: string;
  city?: string;
  timezone?: string;
}

export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";

export interface VisitMemory {
  count: number;
  /** Days since epoch of the previous visit. */
  lastVisitDay?: number;
}

export interface ContextEnvelope {
  /** Arrival source from `?src=` (lowercased). */
  src?: string;
  /** All `utm_*` query parameters. */
  utm: Record<string, string>;
  referrer?: string;
  geo?: Geo;
  /** Preferred languages from Accept-Language, most preferred first (BCP 47 tags). */
  languages: string[];
  device: DeviceClass;
  saveData: boolean;
  /** Server time of the request (ISO 8601). Local times are derived from it in situation rules. */
  now: string;
  /** Visitor time zone when known (IANA). */
  timezone?: string;
  consent: boolean;
  /** Roles of an authenticated first-party viewer (from the app session), if any. */
  roles?: string[];
  /**
   * First-party facts the site already knows about this visitor from its own systems
   * (e.g. a booking's arrival date resolved from a confirmation-email link). Plain strings,
   * no personal data: situation rules turn them into labels; they never reach a decider.
   */
  firstParty?: Record<string, string>;
  /** Only present with consent. */
  visit?: VisitMemory;
}

export interface RequestLike {
  url: string;
  headers: Headers | Record<string, string | undefined>;
  ip?: string;
}

export type GeoLookup = (ip: string | undefined, headers: HeaderReader) => Geo | undefined;
export type HeaderReader = (name: string) => string | undefined;

export const CONSENT_COOKIE = "w4_consent";
export const VISIT_COOKIE = "w4_visit";

export interface CollectOptions {
  geoLookup?: GeoLookup;
  /** Clock override (tests, fixtures). */
  now?: Date;
}

export interface CollectResult {
  envelope: ContextEnvelope;
  /** Set-Cookie header value to persist visit memory; only produced with consent. */
  setCookie?: string;
}

/** Build the Tier 0 envelope from a request. Missing signals are left undefined ("unknown"). */
export function collectEnvelope(request: RequestLike, options: CollectOptions = {}): CollectResult {
  const header = headerReader(request.headers);
  const url = new URL(request.url, "http://localhost");
  const now = options.now ?? new Date();

  const utm: Record<string, string> = {};
  for (const [k, v] of url.searchParams) if (k.startsWith("utm_")) utm[k] = v.toLowerCase();

  const geo = (options.geoLookup ?? cdnGeoLookup)(request.ip, header);
  const cookies = parseCookies(header("cookie"));
  const consent = cookies[CONSENT_COOKIE] === "1";

  const envelope: ContextEnvelope = {
    utm,
    languages: parseAcceptLanguage(header("accept-language")),
    device: detectDevice(header),
    saveData: header("save-data")?.toLowerCase() === "on" || isSlowConnection(header("ect")),
    now: now.toISOString(),
    consent,
  };
  const src = url.searchParams.get("src")?.trim().toLowerCase();
  if (src) envelope.src = src;
  const referrer = header("referer") ?? header("referrer");
  if (referrer) envelope.referrer = referrer;
  if (geo) envelope.geo = geo;
  const timezone = geo?.timezone ?? header("x-vercel-ip-timezone");
  if (timezone) envelope.timezone = timezone;

  let setCookie: string | undefined;
  if (consent) {
    const previous = parseVisit(cookies[VISIT_COOKIE]);
    const today = Math.floor(now.getTime() / 86_400_000);
    envelope.visit = previous ?? { count: 0 };
    const next = { count: (previous?.count ?? 0) + 1, lastVisitDay: today };
    setCookie = `${VISIT_COOKIE}=${next.count}.${next.lastVisitDay}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
  }
  return setCookie ? { envelope, setCookie } : { envelope };
}

export function headerReader(headers: RequestLike["headers"]): HeaderReader {
  if (typeof (headers as Headers).get === "function") {
    return (name) => (headers as Headers).get(name) ?? undefined;
  }
  const lower = Object.fromEntries(
    Object.entries(headers as Record<string, string | undefined>).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
  return (name) => lower[name.toLowerCase()] ?? undefined;
}

/** Reads CDN-provided geolocation headers (Vercel, Cloudflare). No IP database is bundled. */
export const cdnGeoLookup: GeoLookup = (_ip, header) => {
  const lat = Number(header("x-vercel-ip-latitude") ?? header("cf-iplatitude"));
  const lng = Number(header("x-vercel-ip-longitude") ?? header("cf-iplongitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return undefined;
  const geo: Geo = { lat, lng };
  const country = header("x-vercel-ip-country") ?? header("cf-ipcountry");
  const city = header("x-vercel-ip-city") ?? header("cf-ipcity");
  const timezone = header("x-vercel-ip-timezone") ?? header("cf-timezone");
  if (country) geo.country = country;
  if (city) geo.city = decodeURIComponent(city);
  if (timezone) geo.timezone = timezone;
  return geo;
};

export function parseAcceptLanguage(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag?.trim() ?? "", q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((l) => l.tag && l.tag !== "*" && Number.isFinite(l.q) && l.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((l) => l.tag);
}

function detectDevice(header: HeaderReader): DeviceClass {
  const ua = header("user-agent");
  const chMobile = header("sec-ch-ua-mobile");
  if (ua && /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (chMobile === "?1") return "mobile";
  if (!ua) return chMobile === "?0" ? "desktop" : "unknown";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

function isSlowConnection(ect: string | undefined): boolean {
  return ect === "slow-2g" || ect === "2g";
}

function parseCookies(value: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function parseVisit(value: string | undefined): VisitMemory | undefined {
  if (!value) return undefined;
  const [count, day] = value.split(".").map(Number);
  if (!Number.isInteger(count) || (count ?? -1) < 0) return undefined;
  return Number.isInteger(day) ? { count: count!, lastVisitDay: day! } : { count: count! };
}
