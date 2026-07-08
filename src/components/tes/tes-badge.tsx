import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type TESBadgeTone = "brand" | "success" | "soft";

const toneClasses: Record<TESBadgeTone, string> = {
  brand: "bg-brand-primary text-white",
  success: "bg-status-successBg text-status-success",
  soft: "bg-brand-lavenderSoft text-brand-primary",
};

export type TESBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: TESBadgeTone;
};

export function TESBadge({
  className,
  tone = "soft",
  ...props
}: TESBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.68rem] font-extrabold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
