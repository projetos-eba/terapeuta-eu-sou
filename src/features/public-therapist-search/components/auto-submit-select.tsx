"use client";

import type { ComponentProps } from "react";

export function AutoSubmitSelect({
  onChange,
  ...props
}: ComponentProps<"select">) {
  return (
    <select
      {...props}
      onChange={(event) => {
        onChange?.(event);

        if (!event.defaultPrevented) {
          event.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
