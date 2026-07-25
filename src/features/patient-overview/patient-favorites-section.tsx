import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import { PatientFavoriteTherapistCard } from "./patient-favorite-therapist-card";
import type { PatientFavoriteProfessional } from "./patient-overview.types";

export function PatientFavoritesSection({
  professionals,
}: {
  professionals: PatientFavoriteProfessional[];
}) {
  return (
    <section
      aria-labelledby="patient-favorites-title"
      className="rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-3 shadow-[var(--tes-shadow-auth-card)]"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2
          id="patient-favorites-title"
          className="font-display text-[23px] font-light italic text-[var(--tes-color-primary-dark)]"
        >
          Seus favoritos
        </h2>
        <Link
          className="text-[10px] font-medium text-brand-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/20"
          href={routes.patient.favoriteTherapists as Route<string>}
        >
          Ver todos <span aria-hidden="true">→</span>
        </Link>
      </div>
      {professionals.length ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {professionals.map((professional) => (
            <PatientFavoriteTherapistCard
              key={professional.id}
              professional={professional}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[var(--tes-color-border)] p-4 text-xs text-[var(--tes-color-text-secondary-app)]">
          Seus profissionais favoritos aparecerão aqui.
        </p>
      )}
    </section>
  );
}
