import { z } from "zod";
import { bindList } from "../data";
import { Card, Heading } from "../primitives";
import { defineComponent } from "../registry";

const fp = (m: [number, number], t: [number, number], d: [number, number]) => ({
  mobile: { colSpan: m[0], rowSpan: m[1] },
  tablet: { colSpan: t[0], rowSpan: t[1] },
  desktop: { colSpan: d[0], rowSpan: d[1] },
});

const MediaItem = z.object({
  image: z.string().min(1),
  imageAlt: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  subtitle: z.string().optional(),
  href: z.string().optional(),
});

const mediaList = (min: number) => z.object({ items: z.array(MediaItem).min(min) });

export const heroCarousel = defineComponent({
  manifest: {
    id: "hero-carousel",
    what: "Large swipeable photos, one at a time; immersive and visual",
    category: "media",
    accepts: [{ shape: "media-list", requires: ["image"], rank: 1 }],
    affordances: ["highlight"],
    footprint: fp([12, 3], [12, 3], [12, 3]),
    mediaHeavy: true,
    fallback: "caption-list",
  },
  props: mediaList(1),
  toProps: (data, binding) => ({ items: bindList(data, binding) }),
  render: ({ items }, ctx) => (
    <Card flush className="relative">
      <div className="w4-scroll-snap flex snap-x snap-mandatory overflow-x-auto">
        {items.map((item, i) => (
          <figure
            key={`${item.image}-${i}`}
            className="relative aspect-[4/5] w-[88%] shrink-0 snap-center @lg:aspect-[16/9] @lg:w-[78%]"
          >
            <img
              src={item.image}
              alt={item.imageAlt ?? item.title ?? ""}
              className="absolute inset-0 size-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white @lg:p-10">
              {i === 0 && (
                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                  {ctx.eyebrow ?? ctx.label}
                </p>
              )}
              {item.title && (
                <p className="font-display text-3xl leading-[1.05] tracking-tight @lg:text-5xl">
                  {item.title}
                </p>
              )}
              {(item.caption ?? item.subtitle) && (
                <p className="mt-2 max-w-xl text-sm text-white/85 @lg:text-base">
                  {item.caption ?? item.subtitle}
                </p>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </Card>
  ),
});

export const imageGrid = defineComponent({
  manifest: {
    id: "image-grid",
    what: "Grid of photos to browse many at once",
    category: "media",
    accepts: [{ shape: "media-list", requires: ["image"], rank: 5 }],
    affordances: ["browse", "highlight"],
    footprint: fp([12, 2], [12, 2], [8, 2]),
    mediaHeavy: true,
    fallback: "caption-list",
  },
  props: mediaList(2),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 6) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
        {items.map((item, i) => (
          <figure
            key={`${item.image}-${i}`}
            className={i === 0 ? "col-span-2 row-span-2 @lg:col-span-2" : ""}
          >
            <img
              src={item.image}
              alt={item.imageAlt ?? item.title ?? ""}
              className="aspect-square size-full rounded-lg object-cover"
              loading="lazy"
            />
            {item.title && i === 0 && (
              <figcaption className="mt-2 text-sm font-medium">{item.title}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </Card>
  ),
});

export const socialGrid = defineComponent({
  manifest: {
    id: "social-grid",
    what: "Square social-media style feed with handle and captions",
    category: "media",
    accepts: [{ shape: "media-list", requires: ["image", "caption"], rank: 3 }],
    affordances: ["browse", "evaluate"],
    footprint: fp([12, 2], [12, 2], [6, 2]),
    mediaHeavy: true,
    fallback: "caption-list",
  },
  props: z.object({ items: z.array(MediaItem.extend({ caption: z.string() })).min(3) }),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 6) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item, i) => (
          <a
            key={`${item.image}-${i}`}
            href={item.href ?? "#"}
            className="group relative block aspect-square overflow-hidden rounded-md"
          >
            <img
              src={item.image}
              alt={item.imageAlt ?? ""}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-end bg-black/0 p-2 text-[0.7rem] leading-snug text-white opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">
              <span className="line-clamp-3">{item.caption}</span>
            </span>
          </a>
        ))}
      </div>
    </Card>
  ),
});

/** Low-media fallback: text only, no images downloaded. */
export const captionList = defineComponent({
  manifest: {
    id: "caption-list",
    what: "Text-only list of photo captions; no images, very light",
    category: "media",
    accepts: [{ shape: "media-list", rank: 50 }],
    affordances: ["browse"],
    footprint: fp([12, 1], [12, 1], [6, 1]),
    mediaHeavy: false,
  },
  props: z.object({
    items: z
      .array(
        z.object({
          title: z.string().optional(),
          caption: z.string().optional(),
          imageAlt: z.string().optional(),
        }),
      )
      .min(1),
  }),
  toProps: (data, binding) => ({ items: bindList(data, binding).slice(0, 5) }),
  render: ({ items }, ctx) => (
    <Card>
      <Heading label={ctx.label} eyebrow={ctx.eyebrow} />
      <ul className="divide-y divide-border">
        {items.map((item, i) => (
          <li key={i} className="py-2.5 text-sm">
            <span className="font-medium">{item.title ?? item.imageAlt}</span>
            {item.caption && <span className="block text-muted-foreground">{item.caption}</span>}
          </li>
        ))}
      </ul>
    </Card>
  ),
});
