import Link from "next/link";
import type { Route } from "next";
import { BellDot, Clock3, Heart, MessageSquareDot } from "lucide-react";

type ActivityKind = "favorites" | "history" | "messages" | "notifications";

const activityIcons = {
  favorites: Heart,
  history: Clock3,
  messages: MessageSquareDot,
  notifications: BellDot,
};

export function PatientActivityCard({
  description,
  href,
  kind,
  label,
  linkLabel,
}: {
  description: string;
  href?: string;
  kind: ActivityKind;
  label: string;
  linkLabel?: string;
}) {
  const Icon = activityIcons[kind];
  const iconBackground =
    kind === "notifications" ? "bg-status-warningBg" : "bg-brand-lavenderSoft";

  return (
    <article className="min-h-[92px] rounded-[13px] border border-[var(--tes-color-border)]/40 bg-white p-3 shadow-[var(--tes-shadow-auth-card)]">
      <div className="flex gap-3">
        <span
          className={`inline-flex size-[42px] shrink-0 items-center justify-center rounded-full ${iconBackground}`}
        >
          <Icon
            aria-hidden="true"
            className="size-5 text-brand-primary"
            strokeWidth={1.8}
          />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--tes-color-primary-dark)]">
            {label}
          </h3>
          <p className="mt-1 text-xs text-[var(--tes-color-text-secondary-app)]">
            {description}
          </p>
          {href && linkLabel ? (
            <Link
              className="mt-3 inline-flex text-xs font-medium text-brand-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/20"
              href={href as Route<string>}
            >
              {linkLabel}{" "}
              <span aria-hidden="true" className="ml-1">
                →
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
