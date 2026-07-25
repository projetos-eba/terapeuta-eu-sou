import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFooter, PublicHeader } from "@/components/tes";
import { TherapyDetailPage } from "@/features/therapies/components/detail/therapy-detail-page";
import { buildTherapySource } from "@/features/therapies/components/detail/detail-links";
import { getPublicTherapyDetail } from "@/features/therapies/queries/get-public-therapy-detail";
import {
  getRelatedTherapists,
  parseRelatedTherapistSort,
} from "@/features/therapies/queries/get-related-therapists";
import { routes } from "@/lib/routes";

export const revalidate = 900;

type TherapyDetailRouteProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: TherapyDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    return {
      title: "Terapia não encontrada | Terapeuta Eu Sou",
      robots: { follow: false, index: false },
    };
  }

  const therapy = await getPublicTherapyDetail(slug);

  if (!therapy) {
    return {
      title: "Terapia não encontrada | Terapeuta Eu Sou",
      robots: { follow: false, index: false },
    };
  }

  const canonical = routes.public.therapyDetail(therapy.slug);
  const title = therapy.seoTitle ?? `${therapy.name} | Terapeuta Eu Sou`;
  const description = therapy.seoDescription ?? therapy.shortDescription;

  return {
    alternates: {
      canonical,
    },
    description,
    openGraph: {
      description,
      images: therapy.heroImageUrl ? [therapy.heroImageUrl] : undefined,
      title,
      type: "website",
      url: canonical,
    },
    title,
  };
}

export default async function PublicTherapyDetailRoute({
  params,
  searchParams,
}: TherapyDetailRouteProps) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);

  if (!isValidSlug(slug)) {
    notFound();
  }

  const therapy = await getPublicTherapyDetail(slug);

  if (!therapy) {
    notFound();
  }

  const source = buildTherapySource(
    Array.isArray(queryParams?.source)
      ? queryParams?.source[0]
      : queryParams?.source,
  );
  const sort = parseRelatedTherapistSort(queryParams?.sort);
  const related = await getRelatedTherapists({
    slug: therapy.slug,
    sort,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    category: therapy.category.name,
    description: therapy.shortDescription,
    image: therapy.heroImageUrl,
    name: therapy.name,
    provider: {
      "@type": "Organization",
      name: "Terapeuta Eu Sou",
    },
    url: routes.public.therapyDetail(therapy.slug),
  };

  return (
    <main className="min-h-screen scroll-smooth bg-[#fbf8ff] text-brand-deep">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader />
      <TherapyDetailPage
        relatedErrorMessage={related.errorMessage}
        relatedTherapists={related.items}
        source={source}
        sort={sort}
        therapy={therapy}
      />
      <PublicFooter />
    </main>
  );
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
