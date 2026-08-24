"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";

import type { MessageCenterPlatformItem } from "../message-center.types";

export function PlatformNotificationDialogButton({
  item,
}: {
  item: MessageCenterPlatformItem;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TESButton
        aria-label={`Abrir ${item.title}`}
        className="h-auto min-h-0 max-w-full justify-start rounded-md px-0 py-0 text-left text-sm font-extrabold text-brand-deep hover:bg-transparent hover:text-brand-primary hover:underline"
        onClick={() => setIsOpen(true)}
        size="sm"
        title={item.title}
        type="button"
        variant="ghost"
      >
        {item.title}
      </TESButton>
      {isOpen ? (
        <TESDialog
          description={item.categoryLabel}
          onClose={() => setIsOpen(false)}
          title={item.title}
        >
          <div className="grid gap-4">
            <div className="flex items-start gap-3 rounded-xl bg-brand-lavenderSoft p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand-primary">
                <Bell aria-hidden="true" size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide text-brand-primary">
                  {item.categoryLabel}
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  {item.timeLabel}
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-brand-deep">
              {item.body}
            </p>
            {item.cta ? (
              <TESButton
                href={item.cta.href}
                onClick={() => setIsOpen(false)}
                size="md"
                variant="primary"
              >
                {item.cta.label}
              </TESButton>
            ) : null}
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}
