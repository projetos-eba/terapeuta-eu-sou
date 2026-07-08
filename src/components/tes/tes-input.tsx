import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TESInputProps = InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: ReactNode;
  wrapperClassName?: string;
};

export function TESInput({
  className,
  leftIcon,
  wrapperClassName,
  ...props
}: TESInputProps) {
  return (
    <div
      className={cn(
        "relative flex h-16 items-center gap-4 rounded-2xl border border-border bg-white px-5 shadow-soft",
        wrapperClassName,
      )}
    >
      {leftIcon}
      <input
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-base font-bold text-brand-deep outline-none placeholder:text-tesText-subtle",
          className,
        )}
        {...props}
      />
    </div>
  );
}
