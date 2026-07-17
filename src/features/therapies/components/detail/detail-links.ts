import { routes } from "@/lib/routes";

export function buildTherapySource(source?: string) {
  return source === "match" ? "match" : "therapy";
}

export function buildTherapistsByTherapyHref({
  source,
  therapySlug,
}: {
  source: string;
  therapySlug: string;
}) {
  const params = new URLSearchParams({
    source,
    therapy: therapySlug,
  });

  return `${routes.public.therapists}?${params.toString()}`;
}

export function buildTherapistProfileHref({
  source,
  therapistSlug,
  therapySlug,
}: {
  source: string;
  therapistSlug: string;
  therapySlug: string;
}) {
  const params = new URLSearchParams({
    source,
    therapy: therapySlug,
  });

  return `${routes.public.therapistProfile(therapistSlug)}?${params.toString()}`;
}
