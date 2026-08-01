import Image from "next/image";
import { CalendarDays, CheckCircle2, Clock, Leaf, Star } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionOverviewCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const ratingLabel = data.therapist.ratingAverage
    ? `${data.therapist.ratingAverage.toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })} (${data.therapist.reviewsCount} avaliações)`
    : "Sem avaliações ainda";

  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card md:p-7">
      <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)_160px]">
        <div>
          <div className="relative size-28 overflow-hidden rounded-full">
            {data.therapist.avatarUrl ? (
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="112px"
                src={data.therapist.avatarUrl}
              />
            ) : (
              <span className="grid size-full place-items-center bg-brand-lavenderSoft text-3xl font-extrabold text-brand-primary">
                {data.therapist.name.charAt(0)}
              </span>
            )}
            {data.therapist.isOnline ? (
              <span className="absolute bottom-2 right-2 size-4 rounded-full border-2 border-white bg-status-success" />
            ) : null}
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-brand-deep">
            {data.therapist.name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-tesText-secondary">
            {data.therapist.roleLabel}
          </p>
          <span className="mt-4 inline-flex min-h-7 items-center rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
            {data.service.therapyName}
          </span>
          <p className="mt-7 flex items-center gap-2 text-sm font-extrabold text-brand-deep">
            <Star
              aria-hidden="true"
              className="fill-status-warning text-status-warning"
              size={17}
            />
            {ratingLabel}
          </p>
        </div>

        <dl className="grid gap-5 border-y border-brand-lavender py-6 sm:grid-cols-2 lg:border-x lg:border-y-0 lg:px-8 lg:py-0">
          <OverviewFact
            icon={CalendarDays}
            label="Data"
            value={data.booking.dateLabel}
          />
          <OverviewFact
            icon={Clock}
            label="Horário"
            value={`${data.booking.timeRangeLabel} (${data.booking.durationLabel})`}
          />
          <OverviewFact
            icon={Leaf}
            label="Terapia"
            value={data.service.therapyName}
          />
        </dl>

        <div className="space-y-5">
          {data.booking.canJoin ? (
            <span className="inline-flex min-h-7 items-center rounded-full bg-status-dangerBg px-3 text-xs font-extrabold text-status-danger">
              ● Ao vivo agora
            </span>
          ) : null}
          <div>
            <p className="text-base font-extrabold text-brand-deep">Status</p>
            <span className="mt-3 inline-flex min-h-7 items-center rounded-full bg-status-successBg px-3 text-xs font-extrabold text-status-success">
              {data.booking.statusLabel}
            </span>
          </div>
          <div>
            <p className="text-base font-extrabold text-brand-deep">
              Pagamento
            </p>
            <span className="mt-3 inline-flex min-h-7 items-center rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
              {data.encounterState.payment.title}
            </span>
          </div>
          <CheckCircle2
            aria-hidden="true"
            className="text-brand-primary"
            size={34}
          />
        </div>
      </div>
    </section>
  );
}

function OverviewFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-4">
      <Icon aria-hidden="true" className="mt-1 text-brand-primary" size={28} />
      <div>
        <dt className="text-base font-extrabold text-brand-deep">{label}</dt>
        <dd className="mt-2 text-sm font-semibold leading-5 text-tesText-secondary">
          {value}
        </dd>
      </div>
    </div>
  );
}
