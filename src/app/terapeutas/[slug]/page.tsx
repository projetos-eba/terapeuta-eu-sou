import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TherapistProfilePage } from "@/features/therapist-profile/components/profile-page";
import {
  getPublicTherapistProfile,
  resolvePublicTherapistSlug,
} from "@/features/therapist-profile";
import { routes } from "@/lib/routes";

type TherapistProfilePageProps = {
  params: {
    slug: string;
  };
};

export const revalidate = 900;

export async function generateMetadata({
  params,
}: TherapistProfilePageProps): Promise<Metadata> {
  const data = await getPublicTherapistProfile(params.slug);

  if (!data) {
    return {
      title: "Perfil não encontrado | Terapeuta Eu Sou",
      robots: { index: false, follow: false },
    };
  }

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
  const data = await getPublicTherapistProfile(params.slug);

  if (!data) {
    const redirectSlug = await resolvePublicTherapistSlug(params.slug);
    if (redirectSlug) {
      redirect(routes.public.therapistProfile(redirectSlug));
    }

    notFound();
  }

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
      <TherapistProfilePage
        profile={data.profile}
        reviews={data.reviews}
      />
    </>
  );
}
