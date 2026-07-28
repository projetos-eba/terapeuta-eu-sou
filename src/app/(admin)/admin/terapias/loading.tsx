export default function AdminTherapiesLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="h-44 animate-pulse rounded-2xl border border-brand-lavender bg-white" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-2xl border border-brand-lavender bg-white" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-64 animate-pulse rounded-2xl border border-brand-lavender bg-white"
              key={index}
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-brand-lavender bg-white" />
      </div>
    </div>
  );
}
