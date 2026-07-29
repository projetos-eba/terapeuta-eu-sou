import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TherapistProfilePage } from "@/features/therapist-profile/components/profile-page";
import { PublicProfileMetricsTracker } from "@/features/public-metrics";
import {
  getPublicTherapistProfile,
  getPublicTherapistProfileResult,
  resolvePublicTherapistSlug,
} from "@/features/therapist-profile";
import { routes } from "@/lib/routes";

type TherapistProfilePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 900;

export async function generateMetadata({
  params,
}: TherapistProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicTherapistProfileResult(slug);

  if (result.status !== "success" && result.status !== "demo") {
    return {
      title: "Perfil não encontrado | Terapeuta Eu Sou",
      robots: { index: false, follow: false },
    };
  }

  const data = result.data;
  const title = `${data.profile.name} | Terapeuta Eu Sou`;
  const description = data.profile.headline || data.profile.bio;
  const canonical = routes.public.therapistProfile(data.profile.slug);

  return {
    alternates: {
      canonical,
    },
    description,
    openGraph: {
      description,
      images: data.profile.heroImage ? [data.profile.heroImage] : undefined,
      title,
      type: "profile",
      url: canonical,
    },
    title,
  };
}

export default async function PublicTherapistProfilePage({
  params,
}: TherapistProfilePageProps) {
  const { slug } = await params;
  const result = await getPublicTherapistProfileResult(slug);

  if (result.status === "degraded") {
    return <TherapistProfileUnavailable correlationId={result.correlationId} />;
  }

  if (result.status === "not_found") {
    const redirectSlug = await resolvePublicTherapistSlug(slug);
    if (redirectSlug) {
      redirect(routes.public.therapistProfile(redirectSlug));
    }

    notFound();
  }

  const data = result.data;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    description: data.profile.headline,
    image: data.profile.heroImage,
    name: data.profile.name,
    url: data.profile.profileUrl,
    makesOffer: data.profile.services.map((service) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        description: service.description,
        name: service.title,
        serviceType: service.therapyName,
      },
      price: service.priceCents / 100,
      priceCurrency: service.currency,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {result.status === "demo" ? <DemoProfileNotice /> : null}
      <PublicProfileMetricsTracker
        enabled={result.status === "success"}
        therapistSlug={data.profile.slug}
      />
      <TherapistProfilePage profile={data.profile} reviews={data.reviews} />
    </>
  );
}

function DemoProfileNotice() {
  return (
    <div className="bg-brand-lavenderSoft px-5 py-3 text-center text-sm font-bold text-brand-deep">
      Modo demonstração ativo: este perfil usa dados demonstrativos.
    </div>
  );
}

function TherapistProfileUnavailable({
  correlationId,
}: {
  correlationId: string;
}) {
  return (
    <main className="min-h-screen bg-brand-lavenderSoft px-5 py-16 text-center text-tesText-primary">
      <div className="mx-auto max-w-xl rounded-2xl border border-brand-lavender bg-white p-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">
          Perfil temporariamente indisponível
        </h1>
        <p className="mt-4 text-base font-semibold leading-7 text-tesText-secondary">
          Não foi possível consultar este profissional agora. Tente novamente em
          alguns instantes.
        </p>
        <p className="mt-4 text-xs font-bold text-tesText-secondary">
          Código: {correlationId}
        </p>
      </div>
    </main>
  );
}
