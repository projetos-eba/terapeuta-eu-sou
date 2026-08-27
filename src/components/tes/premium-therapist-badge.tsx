import { Crown } from "lucide-react";

export function PremiumTherapistBadge({
  therapistName,
}: {
  therapistName: string;
}) {
  return (
    <span
      aria-label={`${therapistName} é terapeuta Premium`}
      className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border border-white/80 bg-status-warningBg text-status-warning shadow-card backdrop-blur-sm"
      data-testid="premium-therapist-badge"
      role="img"
      title="Terapeuta Premium"
    >
      <Crown
        aria-hidden="true"
        className="size-5 fill-current"
        strokeWidth={1.8}
      />
    </span>
  );
}
