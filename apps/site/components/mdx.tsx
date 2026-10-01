import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { SituationEmbed } from "./embed/situation-embed";

export function getMDXComponents(components?: MDXComponents) {
  return { ...defaultMdxComponents, SituationEmbed, ...components } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
