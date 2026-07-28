"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export function ProfileFieldGroup({
  children,
  description,
  number,
  title,
}: {
  children: ReactNode;
  description?: string;
  number?: number;
  title: string;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-base font-extrabold leading-6 text-brand-deep">
        {number ? `${number}. ` : ""}
        {title}
      </legend>
      {description ? (
        <p className="text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}

export function ProfileTextField({
  description,
  id,
  label,
  onChange,
  value,
  ...props
}: {
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange" | "value">) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p
          className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      <input
        aria-describedby={descriptionId}
        className="mt-3 min-h-11 w-full rounded-lg border border-brand-lavender/70 bg-white px-4 text-sm font-bold text-brand-deep shadow-card outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20 disabled:bg-brand-lavenderSoft disabled:text-tesText-subtle"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
        {...props}
      />
    </div>
  );
}

export function ProfileTextarea({
  description,
  id,
  label,
  maxLength,
  onChange,
  rows = 4,
  value,
  ...props
}: {
  description?: string;
  id: string;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "maxLength" | "onChange" | "rows" | "value"
>) {
  const descriptionId = description ? `${id}-description` : undefined;
  const counterId = maxLength ? `${id}-counter` : undefined;
  const describedBy = [descriptionId, counterId].filter(Boolean).join(" ");

  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p
          className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      <textarea
        aria-describedby={describedBy || undefined}
        className="mt-3 w-full resize-y rounded-lg border border-brand-lavender/70 bg-white px-4 py-3 text-sm font-bold leading-6 text-brand-deep shadow-card outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20 disabled:bg-brand-lavenderSoft disabled:text-tesText-subtle"
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
        {...props}
      />
      {maxLength ? (
        <p
          className="mt-2 text-xs font-bold leading-5 text-tesText-subtle"
          id={counterId}
        >
          {value.length}/{maxLength} caracteres
        </p>
      ) : null}
    </div>
  );
}

export function ProfileChipInput({
  addLabel = "Adicionar item",
  items,
  label,
  max,
  onChange,
  placeholder,
}: {
  addLabel?: string;
  items: string[];
  label: string;
  max: number;
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const safeItems = items.slice(0, max);

  function update(index: number, value: string) {
    const next = [...safeItems];
    next[index] = value;
    onChange(next.filter((item) => item.trim()));
  }

  function addItem() {
    if (safeItems.length >= max) return;
    onChange([...safeItems, placeholder]);
  }

  function removeItem(index: number) {
    onChange(safeItems.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="grid gap-3">
      <span className="sr-only">{label}</span>
      <div className="flex flex-wrap gap-3">
        {safeItems.map((item, index) => (
          <label
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-bold text-tesText-secondary shadow-card"
            key={`${label}-${index}`}
          >
            <span className="sr-only">
              {label} {index + 1}
            </span>
            <input
              className="min-w-[9ch] max-w-[18ch] bg-transparent outline-none"
              onChange={(event) => update(index, event.target.value)}
              value={item}
            />
            <button
              aria-label={`Remover ${item}`}
              className="grid size-6 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              onClick={() => removeItem(index)}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </label>
        ))}
        {safeItems.length < max ? (
          <button
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-full border border-dashed border-brand-primary px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary",
            )}
            onClick={addItem}
            type="button"
          >
            {addLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
