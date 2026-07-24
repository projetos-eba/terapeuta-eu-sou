import { Sparkle } from "lucide-react";

export function RecentJourneyCard({ topics }: { topics: string[] }) {
  return (
    <section
      aria-labelledby="patient-recent-journey-title"
      className="rounded-card border border-brand-lavender bg-white p-6 shadow-card"
    >
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Sparkle aria-hidden="true" size={22} />
      </span>
      <h2
        id="patient-recent-journey-title"
        className="mt-6 font-display text-3xl font-light italic text-brand-deep md:text-4xl"
      >
        Sua jornada recente
      </h2>
      <p className="mt-2 text-sm font-semibold text-tesText-secondary">
        Nos últimos 30 dias você buscou:
      </p>
      {topics.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li
              className="rounded-full bg-brand-lavenderSoft px-4 py-2 text-sm font-extrabold text-brand-primary"
              key={topic}
            >
              {topic}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-card border border-dashed border-brand-lavender bg-surface-soft p-4 text-sm font-semibold text-tesText-secondary">
          Seus temas recentes aparecerão aqui após novos encontros.
        </p>
      )}
      <p className="mt-8 rounded-card bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
        Pequenas escolhas diárias constroem grandes transformações.
      </p>
    </section>
  );
}
