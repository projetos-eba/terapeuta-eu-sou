"use client";

import { useState } from "react";

import { TESDialog } from "@/components/tes";

export const PUBLIC_SERVICE_DESCRIPTION_PREVIEW_LENGTH = 180;

type PublicServiceDescriptionProps = {
  description: string;
  serviceName: string;
};

export function PublicServiceDescription({
  description,
  serviceName,
}: PublicServiceDescriptionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasMore =
    description.length > PUBLIC_SERVICE_DESCRIPTION_PREVIEW_LENGTH;
  const preview = description.slice(
    0,
    PUBLIC_SERVICE_DESCRIPTION_PREVIEW_LENGTH,
  );

  return (
    <>
      <div className="mt-3 min-w-0 max-w-full">
        <p className="min-h-[46px] break-words text-sm leading-[1.5] text-tesText-secondary [overflow-wrap:anywhere]">
          {hasMore ? `${preview}…` : description}
        </p>
        {hasMore ? (
          <button
            aria-haspopup="dialog"
            aria-label={`Ver mais sobre ${serviceName}`}
            className="inline-flex min-h-11 items-center text-sm font-bold text-brand-primary underline decoration-1 underline-offset-2 transition hover:text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            Ver mais
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <TESDialog
          description="Descrição completa desta terapia."
          onClose={() => setIsOpen(false)}
          title={serviceName}
        >
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-tesText-secondary [overflow-wrap:anywhere]">
            {description}
          </p>
        </TESDialog>
      ) : null}
    </>
  );
}
