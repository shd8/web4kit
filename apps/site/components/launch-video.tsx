import { existsSync } from "node:fs";
import { join } from "node:path";

/** The launch video's published files (spec: launch-video, published outputs only). */
export const MEDIA = {
  video: "media/web4kit-launch.mp4",
  captions: "media/web4kit-launch.vtt",
  poster: "media/web4kit-launch.jpg",
};
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The main cut with captions on, when it has been published; nothing otherwise. */
export function LaunchVideo() {
  if (!existsSync(join(process.cwd(), "public", MEDIA.video))) return null;
  return (
    // biome-ignore lint/a11y/useMediaCaption: the captions track is the <track> below
    <video
      data-launch-video=""
      controls
      playsInline
      preload="metadata"
      poster={`${base}/${MEDIA.poster}`}
      className="w-full rounded-2xl border border-fd-border bg-black"
    >
      <source src={`${base}/${MEDIA.video}`} type="video/mp4" />
      <track
        kind="captions"
        src={`${base}/${MEDIA.captions}`}
        srcLang="en"
        label="English"
        default
      />
    </video>
  );
}
