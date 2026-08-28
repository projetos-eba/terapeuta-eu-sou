import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { routes } from "@/lib/routes";

import type {
  PatientEncounter,
  PatientEncountersPagination,
} from "../patient-encounters.types";
import { EncounterRow } from "./encounter-row";

export function EncounterHistorySection({
  encounters,
  pagination,
}: {
  encounters: PatientEncounter[];
  pagination: PatientEncountersPagination;
}) {
  return (
    <section
      aria-labelledby="patient-history-encounters-title"
      className="border-t border-border pt-7 sm:pt-8"
    >
      <div className="max-w-[720px]">
        <h2
          className="font-display text-[1.8rem] font-light italic leading-tight text-brand-deep sm:text-[2.1rem]"
          id="patient-history-encounters-title"
        >
          Histórico de encontros
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Revisite suas experiências anteriores.
        </p>
      </div>

      {encounters.length > 0 ? (
        <div
          className="mt-5 max-h-[760px] overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin]"
          data-testid="patient-history-scroll"
        >
          <div className="divide-y divide-border border-y border-border">
            {encounters.map((encounter) => (
              <EncounterRow encounter={encounter} key={encounter.id} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 max-w-[620px] text-sm font-semibold leading-6 text-tesText-muted">
          Seu histórico aparecerá aqui depois dos encontros realizados.
        </p>
      )}

      {pagination.totalPages > 1 ? (
        <HistoryPagination pagination={pagination} />
      ) : null}
    </section>
  );
}

function HistoryPagination({
  pagination,
}: {
  pagination: PatientEncountersPagination;
}) {
  const first = (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total,
  );
  const previousHref = buildHistoryPageHref(pagination.page - 1);
  const nextHref = buildHistoryPageHref(pagination.page + 1);

  return (
    <nav
      aria-label="Paginação do histórico de encontros"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-lavender/70 pt-4"
      data-testid="patient-history-pagination"
    >
      <p className="text-xs font-semibold text-tesText-secondary">
        {first}–{last} de {pagination.total} encontros
      </p>
      <div className="flex items-center gap-2">
        {pagination.page > 1 ? (
          <Link
            aria-label="Página anterior do histórico"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={previousHref}
          >
            <ChevronLeft aria-hidden="true" size={17} />
            Anterior
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender/50 px-4 text-sm font-extrabold text-tesText-muted"
          >
            <ChevronLeft aria-hidden="true" size={17} />
            Anterior
          </span>
        )}
        <span
          aria-live="polite"
          className="text-sm font-extrabold text-brand-primary"
        >
          Página {pagination.page} de {pagination.totalPages}
        </span>
        {pagination.hasNext ? (
          <Link
            aria-label="Próxima página do histórico"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={nextHref}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={17} />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary/40 px-4 text-sm font-extrabold text-white"
          >
            Próxima
            <ChevronRight aria-hidden="true" size={17} />
          </span>
        )}
      </div>
    </nav>
  );
}

function buildHistoryPageHref(page: number) {
  const [pathname, fragment] = routes.patient.encounterHistory.split("#", 2);
  const query = page > 1 ? `?historyPage=${page}` : "";
  return `${pathname}${query}${fragment ? `#${fragment}` : ""}`;
}
