import Image from "next/image";

import { cn } from "@/lib/utils";

type TESDecorativeMediaFade = "bottom" | "left" | "none" | "right";
type TESDecorativeMediaTone = "brand" | "soft" | "surface";

const fadeClasses: Record<
  Exclude<TESDecorativeMediaFade, "none">,
  Record<TESDecorativeMediaTone, string>
> = {
  bottom: {
    brand:
      "bg-[linear-gradient(0deg,var(--tes-color-brand-primary)_0%,var(--tes-color-brand-primary)_14%,transparent_34%)]",
    soft: "bg-[linear-gradient(0deg,var(--tes-color-surface-soft)_0%,var(--tes-color-surface-soft)_14%,transparent_34%)]",
    surface:
      "bg-[linear-gradient(0deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_14%,transparent_34%)]",
  },
  left: {
    brand:
      "bg-[linear-gradient(90deg,var(--tes-color-brand-primary)_0%,var(--tes-color-brand-primary)_14%,transparent_34%)]",
    soft: "bg-[linear-gradient(90deg,var(--tes-color-surface-soft)_0%,var(--tes-color-surface-soft)_14%,transparent_34%)]",
    surface:
      "bg-[linear-gradient(90deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_14%,transparent_34%)]",
  },
  right: {
    brand:
      "bg-[linear-gradient(270deg,var(--tes-color-brand-primary)_0%,var(--tes-color-brand-primary)_14%,transparent_34%)]",
    soft: "bg-[linear-gradient(270deg,var(--tes-color-surface-soft)_0%,var(--tes-color-surface-soft)_14%,transparent_34%)]",
    surface:
      "bg-[linear-gradient(270deg,var(--tes-color-surface-default)_0%,var(--tes-color-surface-default)_14%,transparent_34%)]",
  },
};

export type TESDecorativeMediaProps = {
  className?: string;
  fade?: TESDecorativeMediaFade;
  fadeTone?: TESDecorativeMediaTone;
  imageClassName?: string;
  objectPosition?: string;
  priority?: boolean;
  quality?: 75 | 95;
  sizes: string;
  src: string;
};

/** Decorative media only. Content and controls remain semantic siblings. */
export function TESDecorativeMedia({
  className,
  fade = "none",
  fadeTone = "surface",
  imageClassName,
  objectPosition = "center",
  priority = false,
  quality = 75,
  sizes,
  src,
}: TESDecorativeMediaProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("absolute overflow-hidden", className)}
      data-fade={fade}
    >
      <Image
        alt=""
        className={cn("object-cover", imageClassName)}
        fill
        priority={priority}
        quality={quality}
        sizes={sizes}
        src={src}
        style={{ objectPosition }}
      />
      {fade !== "none" ? (
        <span className={cn("absolute inset-0", fadeClasses[fade][fadeTone])} />
      ) : null}
    </div>
  );
}
