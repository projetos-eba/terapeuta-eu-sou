"use client";

import { Eye, EyeOff } from "lucide-react";

export function PasswordVisibilityToggle({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  const label = isVisible ? "Ocultar senha" : "Mostrar senha";

  return (
    <button
      aria-label={label}
      aria-pressed={isVisible}
      className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-tesText-muted transition hover:bg-brand-lavenderSoft hover:text-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
      onClick={onToggle}
      type="button"
    >
      {isVisible ? (
        <EyeOff aria-hidden="true" className="size-5" />
      ) : (
        <Eye aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}
