import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { Star } from "lucide-react";

import { routes } from "@/lib/routes";

import type { PendingPatientReview } from "./patient-overview.types";

export function PatientReviewPrompt({
  review,
}: {
  review: PendingPatientReview | null;
}) {
  if (!review) return null;

  return (
    <section
      aria-labelledby="patient-review-title"
      className="relative overflow-hidden rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-5 shadow-[var(--tes-shadow-auth-card)]"
    >
      <h2
        id="patient-review-title"
        className="font-display text-[24px] font-light italic text-[var(--tes-color-primary-dark)]"
      >
        Avalie sua última sessão
      </h2>
      <div className="mt-4 flex items-start gap-3">
        <span className="relative inline-flex size-11 shrink-0 overflow-hidden rounded-full bg-brand-lavenderSoft">
          {review.professional.avatarUrl ? (
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="44px"
              src={review.professional.avatarUrl}
            />
          ) : null}
        </span>
        <div>
          <h3 className="text-xs font-semibold text-[var(--tes-color-primary-dark)]">
            {review.professional.name}
          </h3>
          <p className="mt-1 text-[10px] text-[var(--tes-color-text-secondary-app)]">
            {review.therapyLabel}
          </p>
          <p className="mt-2 max-w-[210px] text-[10px] leading-4 text-[var(--tes-color-text-secondary-app)]">
            Sua opinião ajuda a melhorar o atendimento e auxilia outros
            pacientes.
          </p>
        </div>
      </div>
      <div aria-label="Avaliação de cinco estrelas" className="mt-4 flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            aria-hidden="true"
            className="size-6 text-brand-primary"
            key={index}
            strokeWidth={1.7}
          />
        ))}
      </div>
      <Link
        className="mt-4 flex min-h-10 items-center justify-center rounded-sm bg-brand-primary px-4 text-xs font-medium text-white outline-none transition hover:bg-brand-primaryHover focus-visible:ring-4 focus-visible:ring-ring/20"
        href={
          `${routes.patient.encounters}?review=${review.appointmentId}` as Route<string>
        }
      >
        Avaliar agora
      </Link>
    </section>
  );
}
