"use client";

import { useId, useState } from "react";
import {
  PHONE_COUNTRIES,
  formatPhoneNumber,
  validatePhoneNumber,
} from "@/lib/phone";

export function PhoneInput({
  countryCode,
  error,
  id,
  label = "Telefone",
  name,
  onCountryCodeChange,
  onPhoneChange,
  phone,
  required = false,
}: {
  countryCode: string;
  error?: string;
  id?: string;
  label?: string;
  name?: string;
  onCountryCodeChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  phone: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const phoneId = id ?? generatedId;
  const errorId = `${phoneId}-error`;
  const validationError = validatePhoneNumber(countryCode, phone, required);
  const [touched, setTouched] = useState(false);
  const visibleError = error ?? (touched ? validationError : undefined);

  return (
    <div className="min-w-0">
      <label
        className="mb-2 block text-sm font-extrabold text-brand-deep"
        htmlFor={phoneId}
      >
        {label}
      </label>
      <div
        className={`flex min-h-12 overflow-hidden rounded-lg border bg-white shadow-card focus-within:ring-4 focus-within:ring-ring/20 ${visibleError ? "border-status-danger" : "border-border"}`}
      >
        <select
          aria-label="Código do país"
          className="w-[80px] shrink-0 border-r border-border bg-brand-lavenderSoft px-1 text-sm font-bold text-brand-deep outline-none"
          onChange={(event) => {
            onCountryCodeChange(event.target.value);
            onPhoneChange(formatPhoneNumber(phone, event.target.value));
          }}
          value={countryCode}
        >
          {PHONE_COUNTRIES.map((country) => (
            <option key={`${country.iso}-${country.code}`} value={country.code}>
              {country.iso} +{country.code}
            </option>
          ))}
        </select>
        <input
          aria-describedby={visibleError ? errorId : undefined}
          aria-invalid={Boolean(visibleError)}
          autoComplete="tel-national"
          className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold text-brand-deep outline-none placeholder:text-tesText-subtle"
          id={phoneId}
          inputMode="tel"
          name={name}
          onBlur={() => setTouched(true)}
          onChange={(event) =>
            onPhoneChange(formatPhoneNumber(event.target.value, countryCode))
          }
          placeholder={
            countryCode === "55" ? "(00) 00000-0000" : "Número de telefone"
          }
          required={required}
          type="tel"
          value={phone}
        />
      </div>
      {name ? (
        <input name={`${name}CountryCode`} type="hidden" value={countryCode} />
      ) : null}
      {visibleError ? (
        <p
          className="mt-2 text-xs font-bold text-status-danger"
          id={errorId}
          role="alert"
        >
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}
