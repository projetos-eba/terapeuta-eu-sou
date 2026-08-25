"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { Info, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function ProfileFieldGroup({
  children,
  description,
  info,
  number,
  title,
}: {
  children: ReactNode;
  description?: string;
  info?: string;
  number?: number;
  title: string;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="flex items-center gap-2 text-base font-extrabold leading-6 text-brand-deep">
        <span>
          {number ? `${number}. ` : ""}
          {title}
        </span>
        {info ? <ProfileInfoHint label={title} text={info} /> : null}
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

function ProfileInfoHint({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <span className="group relative inline-flex" ref={containerRef}>
      <button
        aria-controls={tooltipId}
        aria-expanded={open}
        aria-label={`Saiba mais sobre ${label}`}
        className="grid min-h-11 min-w-11 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      <span
        className={cn(
          "invisible absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-brand-lavender bg-white p-3 text-sm font-semibold leading-5 text-tesText-secondary opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          open && "visible opacity-100",
        )}
        id={tooltipId}
        role="tooltip"
      >
        {text}
      </span>
    </span>
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
    onChange(next);
  }

  function addItem() {
    if (safeItems.length >= max) return;
    onChange([...safeItems, ""]);
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
              placeholder={placeholder}
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
