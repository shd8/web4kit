import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { TryIt } from "@/components/try-it";
import { sitePages } from "@/lib/source";

type Props = { params: Promise<{ slug: string }> };

// Site-only pages (concepts, sources and audience, the thesis when it exists): content/*.mdx.
export const dynamicParams = false;

export default async function Page(props: Props) {
  const page = sitePages.getPage([(await props.params).slug]);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-4xl font-semibold tracking-tight">{page.data.title}</h1>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
      <TryIt />
    </main>
  );
}

export function generateStaticParams() {
  return sitePages.getPages().map((p) => ({ slug: p.slugs[0]! }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const page = sitePages.getPage([(await props.params).slug]);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
