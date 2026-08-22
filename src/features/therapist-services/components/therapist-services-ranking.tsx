import { Leaf } from "lucide-react";

import { TESCard } from "@/components/tes";
import { cn } from "@/lib/utils";

import type { TherapistServiceSummary } from "../therapist-services.types";

export function TherapistServicesRanking({
  services,
}: {
  services: TherapistServiceSummary[];
}) {
  const ranked = services
    .filter((service) => service.metrics.bookingCount > 0)
    .sort((a, b) => b.metrics.bookingCount - a.metrics.bookingCount)
    .slice(0, 3);

  return (
    <TESCard as="section" className="p-5 sm:p-6">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Terapias mais agendadas
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        As terapias que mais recebem agendamentos.
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
              <TherapyThumbnail service={service} />
              <span className="min-w-0">
                <strong className="block truncate text-sm text-brand-primary">
                  {service.title}
                </strong>
                <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-secondary">
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

function TherapyThumbnail({ service }: { service: TherapistServiceSummary }) {
  const fallbackTone = [
    "bg-brand-lavenderSoft",
    "bg-status-successBg",
    "bg-status-warningBg",
    "bg-status-infoBg",
  ][Math.abs(hashString(service.therapyId)) % 4];

  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg",
        fallbackTone,
      )}
    >
      {service.therapy.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem administrada pelo catálogo público.
        <img
          alt={`Imagem da terapia ${service.therapy.name}`}
          className="size-full object-cover"
          src={service.therapy.imageUrl}
        />
      ) : (
        <Leaf aria-hidden="true" className="size-5 text-brand-primary" />
      )}
    </span>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
