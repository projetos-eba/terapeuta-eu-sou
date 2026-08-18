"use client";

import Image from "next/image";
import { Expand } from "lucide-react";
import { useState } from "react";

import { TESDialog } from "@/components/tes";
import { bioIllustrationById } from "@/features/therapist-profile/personalization";

import type { BioIllustrationId } from "../types";

export function BioIllustrationDialog({
  illustrationId,
}: {
  illustrationId: BioIllustrationId;
}) {
  const [open, setOpen] = useState(false);
  const illustration = bioIllustrationById[illustrationId];

  return (
    <>
      <button
        aria-label={`Ampliar ilustração ${illustration.label}`}
        className="group mt-6 w-full rounded-lg border border-border bg-surface-mist p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="relative block aspect-[16/8] overflow-hidden rounded-md">
          <Image
            alt=""
            className="object-cover transition duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
            fill
            sizes="420px"
            src={illustration.src}
          />
          <span className="absolute bottom-2 right-2 grid size-11 place-items-center rounded-full bg-white/90 text-brand-primary shadow-card">
            <Expand aria-hidden="true" className="size-5" />
          </span>
        </span>
        <span className="mt-2 block text-sm font-bold text-brand-deep">
          {illustration.label}
        </span>
      </button>

      {open ? (
        <TESDialog
          className="max-w-[820px]"
          description={illustration.description}
          onClose={() => setOpen(false)}
          title={illustration.label}
        >
          <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-surface-mist">
            <Image
              alt={illustration.alt}
              className="object-contain"
              fill
              priority
              sizes="820px"
              src={illustration.src}
            />
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}
