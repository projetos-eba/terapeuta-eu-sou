import type { LucideIcon } from "lucide-react";

export function PatientEncounterMetricCard({
  icon: Icon,
  label,
  supportingText,
  value,
}: {
  icon: LucideIcon;
  label: string;
  supportingText: string;
  value: string;
}) {
  return (
    <article className="min-h-[190px] rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
      </span>
      <p className="mt-6 text-sm font-extrabold text-tesText-secondary">
        {label}
      </p>
      <p className="mt-3 text-3xl font-extrabold leading-none text-brand-deep">
        {value}
      </p>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
        {supportingText}
      </p>
    </article>
  );
}
