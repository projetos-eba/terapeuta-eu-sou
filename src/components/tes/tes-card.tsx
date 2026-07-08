import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type TESCardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
};

export function TESCard({
  as: Component = "article",
  className,
  ...props
}: TESCardProps) {
  return (
    <Component
      className={cn(
        "rounded-card border border-border/80 bg-white shadow-card",
        className,
      )}
      {...props}
    />
  );
}
