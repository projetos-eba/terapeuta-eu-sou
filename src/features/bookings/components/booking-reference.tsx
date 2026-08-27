import { cn } from "@/lib/utils";

export function BookingReference({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  if (!id) return null;

  return (
    <p
      className={cn(
        "mt-1 block max-w-full truncate whitespace-nowrap text-[11px] font-semibold leading-4 text-tesText-muted sm:text-xs",
        className,
      )}
      data-testid="booking-reference"
      title={`ID: ${id}`}
    >
      ID: <span className="font-mono tracking-[-0.01em]">{id}</span>
    </p>
  );
}
