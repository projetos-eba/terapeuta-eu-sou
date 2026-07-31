import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  Heart,
  Search,
  Star,
} from "lucide-react";

import {
  PublicFooter,
  PublicHeader,
  TESButton,
  TESCard,
} from "@/components/tes";
import {
  availabilityOptions,
  getPublicTherapistSearchResult,
  parseTherapistSearchParams,
  priceOptions,
  ratingOptions,
  sortOptions,
  therapistSearchHero,
  toSearchParams,
  type TherapistSearchCard,
  type TherapistSearchFilters,
  type TherapistSearchOption,
} from "@/features/public-therapist-search";
import {
  PublicSearchMetricsTracker,
  TrackedBookingLink,
} from "@/features/public-metrics";
import { buildPublicTherapistTherapyChips } from "@/features/public-therapists/therapy-presentation";
import { routes } from "@/lib/routes";

export const revalidate = 900;

type TherapistsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function HeroIllustration() {
  return (
    <div className="pointer-events-none absolute right-[-74px] top-[-27px] hidden h-[351px] w-[765px] overflow-hidden lg:block">
      <Image
        src="/therapists/hero-therapists.png"
        alt=""
        fill
        sizes="765px"
        className="object-cover object-center"
        priority
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: keyof TherapistSearchFilters;
  options: TherapistSearchOption[];
  value?: string;
}) {
  return (
    <label className="relative flex h-[52px] min-w-[158px] shrink-0 items-center rounded-[16px] border border-border bg-white text-[16px] font-medium text-tesText-muted focus-within:ring-4 focus-within:ring-ring/20">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-full w-full appearance-none rounded-[16px] bg-transparent px-4 pr-12 text-[16px] font-medium leading-[22px] outline-none"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 size-6 text-brand-primary" />
    </label>
  );
}

function SearchFilters({
  filters,
  themeOptions,
  therapyOptions,
}: {
  filters: TherapistSearchFilters;
  themeOptions: TherapistSearchOption[];
  therapyOptions: TherapistSearchOption[];
}) {
  return (
    <section className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-[68px]">
      <form
        action={routes.public.therapists}
        className="rounded-[30px] border border-brand-lavender bg-surface-soft p-[24px] shadow-card"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-brand-primary" />
          <input
            aria-label="Buscar terapeuta"
            className="h-[54px] w-full rounded-[16px] border border-border bg-white px-14 text-[16px] font-medium text-tesText-primary outline-none placeholder:text-tesText-muted focus:ring-4 focus:ring-ring/20"
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="Nome, abordagem ou especialidade"
            type="search"
          />
        </div>

        <div className="mt-[37px] flex flex-wrap items-start gap-[14px]">
          <SelectField
            label="Tipo de terapia"
            name="therapy"
            options={therapyOptions}
            value={filters.therapy}
          />
          <SelectField
            label="Tema buscado"
            name="theme"
            options={themeOptions}
            value={filters.theme}
          />
          <SelectField
            label="Disponibilidade"
            name="availability"
            options={availabilityOptions}
            value={filters.availability}
          />
          <SelectField
            label="Preço"
            name="price"
            options={priceOptions}
            value={filters.price}
          />
          <SelectField
            label="Avaliação"
            name="rating"
            options={ratingOptions}
            value={filters.rating}
          />
          <input type="hidden" name="sort" value={filters.sort} />
          <Link
            href={routes.public.therapists as Route}
            className="inline-flex h-[52px] w-[177px] items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-[15px] font-semibold text-white transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20"
          >
            Limpar Filtros
            <Filter className="size-[17px]" />
          </Link>
          <button className="sr-only">Aplicar filtros</button>
        </div>
      </form>
    </section>
  );
}

function ResultsHeader({
  activeFilterCount,
  filters,
  totalCount,
}: {
  activeFilterCount: number;
  filters: TherapistSearchFilters;
  totalCount: number;
}) {
  return (
    <div className="mb-[26px] grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <h2 className="text-[26px] font-extrabold leading-8 tracking-normal text-brand-deep">
          Caminhos que podem fazer sentido para você
        </h2>
        <p className="mt-1 max-w-[600px] text-[15px] font-semibold leading-6 text-tesText-secondary">
          Com calma, compare abordagens, histórias e formas de acolhimento.
          <br />
          Escolha quando sentir que encontrou alguém com quem deseja caminhar.
        </p>
        {activeFilterCount > 0 ? (
          <p className="mt-2 text-xs font-bold text-brand-primary">
            {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} ativo
            {activeFilterCount > 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 lg:text-right">
        <p className="text-[16px] font-semibold leading-7 text-tesText-secondary">
          Encontramos {totalCount} terapeuta{totalCount === 1 ? "" : "s"}
        </p>
        <form action={routes.public.therapists}>
          {filters.q ? (
            <input type="hidden" name="q" value={filters.q} />
          ) : null}
          {filters.therapy ? (
            <input type="hidden" name="therapy" value={filters.therapy} />
          ) : null}
          {filters.theme ? (
            <input type="hidden" name="theme" value={filters.theme} />
          ) : null}
          {filters.availability ? (
            <input
              type="hidden"
              name="availability"
              value={filters.availability}
            />
          ) : null}
          {filters.price ? (
            <input type="hidden" name="price" value={filters.price} />
          ) : null}
          {filters.rating ? (
            <input type="hidden" name="rating" value={filters.rating} />
          ) : null}
          <label className="relative inline-flex min-h-11 w-full max-w-[310px] items-center rounded-full border border-brand-lavender bg-white text-sm font-bold text-tesText-secondary shadow-card sm:w-[270px]">
            <span className="sr-only">Ordenar terapeutas</span>
            <select
              name="sort"
              defaultValue={filters.sort}
              className="h-full w-full appearance-none truncate rounded-full bg-transparent px-[15px] pr-10 text-sm font-bold outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Ordenar por: {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 size-4 text-brand-primary" />
          </label>
          <button className="sr-only">Ordenar</button>
        </form>
      </div>
    </div>
  );
}

function Rating({
  rating,
  ratingLabel,
}: {
  rating: number;
  ratingLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-[14px] font-extrabold text-brand-deep">
      <span>{ratingLabel}</span>
      <span
        className="flex gap-[1px] text-status-warning"
        aria-label={`${ratingLabel} de 5 estrelas`}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={`size-[13px] ${index + 1 <= Math.round(rating) ? "fill-current" : ""}`}
          />
        ))}
      </span>
    </div>
  );
}

function TherapistResultCard({
  position,
  trackMetrics,
  therapist,
}: {
  position: number;
  trackMetrics: boolean;
  therapist: TherapistSearchCard;
}) {
  const isVerified = therapist.highlightTone === "verified";
  const therapyChips = buildPublicTherapistTherapyChips([
    {
      id: therapist.therapyId,
      name: therapist.therapyName,
      slug: therapist.therapySlug,
    },
  ]);

  return (
    <div
      data-metric-result-position={position}
      data-metric-therapist-slug={therapist.slug}
    >
      <TESCard className="grid gap-5 overflow-hidden rounded-[18px] border border-brand-lavender bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative min-h-[220px] overflow-hidden rounded-[12px] bg-surface-soft sm:min-h-full">
          <Image
            src={therapist.image}
            alt={`Retrato de ${therapist.name}`}
            fill
            sizes="(min-width: 1280px) 180px, 100vw"
            className="object-cover object-center"
          />
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              <span
                className={`inline-flex min-h-7 items-center rounded-full px-3 text-sm font-bold ${
                  isVerified
                    ? "border border-brand-lavender bg-brand-lavenderSoft text-brand-primary"
                    : "border border-brand-primary bg-brand-primary text-white"
                }`}
              >
                {therapist.highlight}
              </span>
              {therapist.hasVideo ? (
                <span className="inline-flex min-h-7 items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft px-3 text-sm font-bold text-brand-primary">
                  Vídeo de apresentação
                </span>
              ) : null}
            </div>
            <Rating
              rating={therapist.rating}
              ratingLabel={therapist.ratingLabel}
            />
          </div>

          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <h3 className="text-2xl font-extrabold leading-tight tracking-normal text-brand-deep">
                {therapist.name}
              </h3>
              <ul
                aria-label={`Terapias oferecidas por ${therapist.name}`}
                className="mt-2 flex flex-wrap gap-2"
              >
                {therapyChips.map((therapy) => (
                  <li key={therapy.id}>
                    <span className="inline-flex min-h-7 max-w-[220px] items-center rounded-full bg-brand-lavenderSoft px-3 text-sm font-bold text-brand-primary">
                      <span className="truncate" title={therapy.label}>
                        {therapy.label}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              aria-label={`Favoritar ${therapist.name}`}
              aria-pressed="false"
              className="grid size-11 shrink-0 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <Heart className="size-5" />
            </button>
          </div>

          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            {therapist.description}
          </p>
          <p className="text-xs font-semibold leading-5 text-tesText-muted">
            {therapist.reviewsLabel}
          </p>

          <div className="flex flex-wrap gap-2">
            {therapist.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex min-h-7 items-center justify-center rounded-full bg-brand-lavenderSoft px-3 text-sm font-semibold text-brand-primary"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs font-semibold leading-5 text-tesText-muted">
                Próximo horário
              </p>
              <p className="mt-1 text-lg font-extrabold leading-normal text-brand-primary">
                {therapist.nextSlotLabel}
              </p>
              <p className="mt-2 text-lg font-extrabold leading-normal text-brand-primary">
                {therapist.priceLabel}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:w-[160px]">
              <Link
                href={therapist.href as Route}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-4 text-center text-sm font-bold leading-5 text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              >
                Conhecer terapeuta
              </Link>
              {trackMetrics ? (
                <TrackedBookingLink
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-lavender bg-white px-4 text-center text-sm font-bold leading-5 text-brand-primary transition hover:border-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={`${routes.public.reservation}?therapist=${therapist.slug}&service=${therapist.serviceId}`}
                  serviceId={therapist.serviceId}
                  sourceSurface="therapist_search"
                  therapistSlug={therapist.slug}
                >
                  Agendar sessão
                </TrackedBookingLink>
              ) : (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-lavender bg-white px-4 text-center text-sm font-bold leading-5 text-brand-primary transition hover:border-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={routes.public.reservation as Route}
                >
                  Agendar sessão
                </Link>
              )}
            </div>
          </div>
        </div>
      </TESCard>
    </div>
  );
}

function EmptyState() {
  return (
    <TESCard className="p-10 text-center">
      <CalendarDays className="mx-auto size-10 text-brand-primary" />
      <h3 className="mt-4 text-2xl font-extrabold text-brand-deep">
        Nenhum terapeuta encontrado
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
        Tente limpar filtros ou buscar por outro tema. A escolha pode acontecer
        com calma, no seu tempo.
      </p>
      <TESButton
        href={routes.public.therapists}
        variant="secondary"
        className="mt-6"
      >
        Limpar filtros
      </TESButton>
    </TESCard>
  );
}

function DegradedState({ correlationId }: { correlationId?: string }) {
  return (
    <TESCard className="border border-brand-lavender bg-white p-10 text-center">
      <CalendarDays className="mx-auto size-10 text-brand-primary" />
      <h3 className="mt-4 text-2xl font-extrabold text-brand-deep">
        Não foi possível consultar os profissionais agora
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
        Tente novamente em alguns instantes. Se o problema continuar, informe o
        código de atendimento abaixo ao suporte.
      </p>
      {correlationId ? (
        <p className="mt-4 text-xs font-bold text-tesText-secondary">
          Código: {correlationId}
        </p>
      ) : null}
    </TESCard>
  );
}

function DemoNotice() {
  return (
    <div className="mb-5 rounded-2xl border border-brand-lavender bg-brand-lavenderSoft px-4 py-3 text-sm font-bold text-brand-deep">
      Modo demonstração ativo: os profissionais abaixo são dados demonstrativos.
    </div>
  );
}

function Pagination({
  filters,
  totalPages,
}: {
  filters: TherapistSearchFilters;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      className="mt-[29px] flex flex-wrap items-center justify-center gap-[18px]"
      aria-label="Paginação"
    >
      {pages.map((page) => {
        const params = toSearchParams(filters, { page });
        const href = `${routes.public.therapists}${params ? `?${params}` : ""}`;
        const isCurrent = page === filters.page;

        return (
          <Link
            key={page}
            href={href as Route}
            aria-current={isCurrent ? "page" : undefined}
            className={`grid size-[34px] place-items-center rounded-full text-[12px] font-bold ${
              isCurrent
                ? "border border-brand-primary bg-brand-primary text-white"
                : "border border-brand-lavender bg-white text-brand-primary"
            }`}
          >
            {page}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function TherapistsPage({
  searchParams,
}: TherapistsPageProps) {
  const params = await searchParams;
  const filters = parseTherapistSearchParams(params);
  const result = await getPublicTherapistSearchResult(filters);

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F8F5FF_42%,#FFFFFF_100%)] text-tesText-primary">
      <PublicHeader />

      <section className="relative mx-auto max-w-[1440px] px-5 pb-[29px] pt-[25px] sm:px-8 lg:px-[68px]">
        <HeroIllustration />
        <div className="relative max-w-[794px] lg:min-h-[261px]">
          <h1 className="max-w-[794px] font-display text-[44px] font-light italic leading-[1.08] text-brand-deep md:text-[54px]">
            <span className="block">Encontre alguém</span>
            <span>para </span>
            <em className="inline font-display font-semibold text-brand-primary md:bg-[linear-gradient(90deg,var(--tes-color-brand-primary)_0%,var(--tes-color-brand-cyan)_100%)] md:bg-clip-text md:text-transparent">
              caminhar com você.
            </em>
          </h1>
          <p className="mt-6 max-w-[530px] text-[16px] font-semibold leading-7 text-tesText-secondary">
            {therapistSearchHero.body}
          </p>
        </div>
      </section>

      <SearchFilters
        filters={result.filters}
        themeOptions={result.options.themes}
        therapyOptions={result.options.therapies}
      />

      <section className="mx-auto max-w-[1440px] px-5 pb-[29px] pt-[41px] sm:px-8 lg:px-[68px]">
        {result.status === "demo" ? <DemoNotice /> : null}
        <ResultsHeader
          activeFilterCount={result.activeFilterCount}
          filters={result.filters}
          totalCount={result.totalCount}
        />

        {result.status === "degraded" ? (
          <DegradedState correlationId={result.correlationId} />
        ) : result.therapists.length ? (
          <div className="grid gap-x-[20px] gap-y-[20px] xl:grid-cols-2">
            <PublicSearchMetricsTracker enabled={result.source === "live"} />
            {result.therapists.map((therapist, index) => (
              <TherapistResultCard
                key={`${therapist.slug}-${therapist.serviceTitle}`}
                position={
                  (result.currentPage - 1) * result.pageSize + index + 1
                }
                trackMetrics={result.source === "live"}
                therapist={therapist}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}

        <Pagination filters={result.filters} totalPages={result.totalPages} />
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-[62px] sm:px-8 lg:px-[68px]">
        <div className="flex h-[178px] items-center justify-center rounded-[18px] border border-[rgba(226,209,236,0.4)] bg-[rgba(241,232,246,0.7)] shadow-[0_8px_10px_rgba(38,20,51,0.04)]">
          <p className="text-center text-[26px] font-extrabold leading-8 text-brand-deep">
            Fazer banner novo
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
