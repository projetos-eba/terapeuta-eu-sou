import { TESCard } from "@/components/tes";

import type { TherapistServiceSummary } from "../therapist-services.types";

export function TherapistServicesRanking({
  services,
}: {
  services: TherapistServiceSummary[];
}) {
  const ranked = services
    .filter(
      (service) =>
        service.metrics.favoriteCount > 0 || service.metrics.bookingCount > 0,
    )
    .sort(
      (a, b) =>
        b.metrics.favoriteCount +
        b.metrics.bookingCount -
        (a.metrics.favoriteCount + a.metrics.bookingCount),
    )
    .slice(0, 3);

  return (
    <TESCard as="section" className="p-5 sm:p-6">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Serviços mais procurados
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Seus serviços com maior destaque na plataforma.
      </p>
      {ranked.length > 0 ? (
        <ol className="mt-6 grid gap-4">
          {ranked.map((service, index) => (
            <li
              className="grid grid-cols-[34px_52px_minmax(0,1fr)] items-center gap-3"
              key={service.serviceId}
            >
              <span className="grid size-7 place-items-center rounded-full bg-brand-lavenderSoft text-xs font-extrabold text-brand-primary">
                {index + 1}
              </span>
              <span className="block size-12 rounded-lg bg-brand-lavenderSoft" />
              <span className="min-w-0">
                <strong className="block truncate text-sm text-brand-primary">
                  {service.title}
                </strong>
                <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-secondary">
                  {service.metrics.favoriteCount} interesses ·{" "}
                  {service.metrics.bookingCount} agendamentos
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 rounded-lg bg-brand-lavenderSoft/70 p-4">
          <p className="text-sm font-extrabold text-brand-deep">
            Ainda sem dados
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
            Começaremos a mostrar esta métrica após as primeiras interações.
          </p>
        </div>
      )}
    </TESCard>
  );
}
