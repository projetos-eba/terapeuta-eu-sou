import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { Heart, Search, Star, Trash2 } from "lucide-react";

import { TESDecorativeMedia } from "@/components/tes";
import { routes } from "@/lib/routes";
import { platformAssets } from "@/lib/platform-assets";

import type {
  PatientFavoriteTherapist,
  PatientFavoriteTherapistsPageData,
} from "./patient-favorites.types";

type PatientFavoriteTherapistsPageProps = {
  data: PatientFavoriteTherapistsPageData;
  removeFavoriteAction: (therapistProfileId: string) => Promise<void>;
};

export function PatientFavoriteTherapistsPage({
  data,
  removeFavoriteAction,
}: PatientFavoriteTherapistsPageProps) {
  return (
    <main className="pb-10 text-tesText-primary">
      <header className="relative isolate overflow-hidden rounded-card bg-surface-soft p-6 md:p-8">
        <TESDecorativeMedia
          className="absolute inset-y-0 right-0 hidden w-[56%] md:block"
          fade="left"
          fadeTone="soft"
          objectPosition="right center"
          priority
          sizes="(min-width: 768px) 52vw, 100vw"
          src={platformAssets.patientFavoritesHero.src}
        />
        <span className="relative z-10 inline-flex min-h-8 items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary">
          <Heart aria-hidden="true" size={16} />
          Favoritos
        </span>
        <div className="relative z-10 mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="font-display text-4xl font-light italic leading-tight text-brand-deep md:text-5xl">
              Terapeutas favoritos
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary md:text-base">
              Retome profissionais que fizeram sentido para sua jornada e siga
              para o perfil público quando quiser agendar um novo encontro.
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.public.therapists as Route<string>}
          >
            <Search aria-hidden="true" size={18} />
            Encontrar terapeutas
          </Link>
        </div>
      </header>

      {data.items.length > 0 ? (
        <section
          aria-label="Lista de terapeutas favoritos"
          className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {data.items.map((item) => (
            <FavoriteTherapistCard
              item={item}
              key={item.id}
              removeFavoriteAction={removeFavoriteAction}
            />
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Heart aria-hidden="true" size={28} />
          </span>
          <h2 className="mt-5 font-display text-3xl font-light italic text-brand-deep">
            Nenhum terapeuta favorito ainda
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
            Quando você salvar um terapeuta, ele aparecerá aqui para retomar a
            busca com calma.
          </p>
          <Link
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.public.therapists as Route<string>}
          >
            Explorar terapeutas
          </Link>
        </section>
      )}
    </main>
  );
}

function FavoriteTherapistCard({
  item,
  removeFavoriteAction,
}: {
  item: PatientFavoriteTherapist;
  removeFavoriteAction: (therapistProfileId: string) => Promise<void>;
}) {
  const removeAction = removeFavoriteAction.bind(null, item.id);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-brand-lavender bg-white shadow-card">
      <div className="relative aspect-[4/3] bg-brand-lavenderSoft">
        {item.avatarUrl ? (
          <Image
            alt=""
            className="object-cover object-center"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            src={item.avatarUrl}
          />
        ) : (
          <span className="grid size-full place-items-center text-4xl font-extrabold text-brand-primary">
            {item.name.charAt(0)}
          </span>
        )}
        <span className="absolute left-4 top-4 inline-flex min-h-7 items-center rounded-full bg-white/90 px-3 text-xs font-extrabold text-brand-primary shadow-card">
          {item.isAcceptingBookings ? "Aceitando encontros" : "Agenda pausada"}
        </span>
      </div>

      <div className="flex h-full flex-col p-5">
        <h2 className="text-lg font-extrabold leading-tight text-brand-deep">
          {item.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-tesText-secondary">
          {item.headline ?? "Terapeuta TES"}
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm font-extrabold text-tesText-secondary">
          <Star
            aria-hidden="true"
            className="size-4 fill-status-warning text-status-warning"
          />
          {item.averageRating !== null
            ? `${item.averageRating.toFixed(1)} · ${item.reviewCount} avaliações`
            : "Ainda sem avaliações"}
        </div>
        {item.summary ? (
          <p className="mt-4 line-clamp-3 text-sm font-semibold leading-6 text-tesText-secondary">
            {item.summary}
          </p>
        ) : null}
        {item.techniques.length > 0 ? (
          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Técnicas do terapeuta"
          >
            {item.techniques.map((technique) => (
              <span
                className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary"
                key={technique}
              >
                {technique}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-auto grid gap-4 px-5 pb-5">
        <form action={removeAction}>
          <button
            className="flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            type="submit"
          >
            <Trash2 aria-hidden="true" size={16} />
            Remover favorito
          </button>
        </form>
        <Link
          className="flex h-11 min-h-11 w-full items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={item.profileHref as Route<string>}
        >
          Ver perfil
        </Link>
      </div>
    </article>
  );
}
