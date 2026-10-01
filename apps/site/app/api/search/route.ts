import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Static export: the search index is a file, searched in the browser (no search server).
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source, { language: "english" });
