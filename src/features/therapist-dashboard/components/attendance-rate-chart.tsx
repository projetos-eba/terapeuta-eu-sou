export function AttendanceRateChart({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col items-center">
      <div
        aria-label={`Taxa de comparecimento: ${normalized}%`}
        className="relative grid size-32 place-items-center rounded-full"
        role="img"
        style={{
          background: `conic-gradient(var(--tes-color-brand-primary) ${normalized * 3.6}deg, var(--tes-color-brand-lavender) 0deg)`,
        }}
      >
        <span className="absolute inset-3 rounded-full bg-white" />
        <strong className="relative text-2xl font-extrabold text-brand-primary">
          {normalized}%
        </strong>
      </div>
      <p className="mt-4 text-center text-sm font-bold text-brand-deep">
        Taxa de comparecimento
      </p>
    </div>
  );
}
