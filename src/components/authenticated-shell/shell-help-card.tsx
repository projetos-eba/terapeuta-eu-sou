import Link from "next/link";
import type { Route } from "next";
import { Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShellHelpCard({
  href,
  label = "Fale conosco",
  variant = "default",
}: {
  href: string;
  label?: string;
  variant?: "default" | "priority" | "therapist";
}) {
  return (
    <section
      className={cn(
        "rounded-[14px] border bg-white p-4",
        variant === "therapist" || variant === "priority"
          ? "border-brand-cyan/50"
          : "border-[var(--tes-color-border)]",
      )}
    >
      <div className="flex items-start gap-3">
        <Headphones
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5",
            variant === "therapist" || variant === "priority"
              ? "text-status-info"
              : "text-brand-primary",
          )}
        />
        <div>
          <h2 className="text-sm font-semibold text-[var(--tes-color-primary-dark)]">
            Precisa de ajuda?
          </h2>
          <p className="mt-2 text-xs leading-5 text-[var(--tes-color-text-secondary-app)]">
            Nossa equipe está aqui para apoiar você.
          </p>
        </div>
      </div>
      <Link
        className={cn(
          "mt-4 flex min-h-10 items-center justify-center rounded-sm px-3 text-xs font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
          variant === "therapist" || variant === "priority"
            ? "bg-brand-cyan/30 text-[#447698] hover:bg-brand-cyan/45"
            : "bg-brand-primary text-white hover:bg-brand-primaryHover",
        )}
        href={href as Route<string>}
      >
        {label}
      </Link>
    </section>
  );
}
