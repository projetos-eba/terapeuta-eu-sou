export function ProfileReadOnlyMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/40 p-4">
      <dt className="text-sm font-bold leading-5 text-tesText-secondary">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-extrabold leading-7 text-brand-deep">
        {value}
      </dd>
    </div>
  );
}
