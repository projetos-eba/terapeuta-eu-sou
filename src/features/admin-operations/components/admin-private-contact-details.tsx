import { Phone } from "lucide-react";

import type { AdminProfessionalProfileReview } from "../admin-operations.types";

type PrivateIdentity = NonNullable<
  AdminProfessionalProfileReview["privateIdentity"]
>;

export function AdminPrivateContactDetails({
  identity,
}: {
  identity: AdminProfessionalProfileReview["privateIdentity"];
}) {
  if (!identity) return null;

  const document = formatDocumentNumber(
    identity.documentType,
    identity.documentNumber,
  );
  const phone = formatPhone(identity.phoneCountryCode, identity.phone);
  const address = formatAddress(identity);

  return (
    <dl className="grid gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-2 xl:grid-cols-3">
      <ContactFact
        label={identity.documentType === "cpf" ? "CPF" : "Documento"}
        value={document || "Não informado"}
      />
      <ContactFact label="Celular" value={phone || "Não informado"} />
      <ContactFact
        label="CEP"
        value={formatPostalCode(identity.postalCode) || "Não informado"}
      />
      <ContactFact
        className="sm:col-span-2 xl:col-span-3"
        label="Endereço"
        value={address || "Não informado"}
      />
    </dl>
  );
}

export function ContactFact({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-tesText-muted sm:text-xs">
        {label === "Celular" ? (
          <Phone aria-hidden="true" className="size-3.5 text-brand-primary" />
        ) : null}
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-extrabold leading-6 text-brand-deep">
        {value}
      </dd>
    </div>
  );
}

function formatDocumentNumber(
  type: "cpf" | "rg" | "passport" | null,
  value: string | null,
) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");

  if (type === "cpf" && digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  return value;
}

export function formatPhone(
  countryCode: string | null,
  value: string | null,
  fallbackCountryCode: string | null = "55",
) {
  if (!value) return "";
  const countryDigits = (countryCode ?? "").replace(/\D/g, "");
  const digits = value.replace(/\D/g, "");
  const country = countryDigits || fallbackCountryCode;
  if (!country) return value;

  if (country === "55" && digits.length === 11) {
    return `+${country} (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (country === "55" && digits.length === 10) {
    return `+${country} (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `+${country} ${digits}`.trim();
}

export function formatPostalCode(value: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");

  return digits.length === 8
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : value;
}

function formatAddress(identity: PrivateIdentity) {
  const line = [identity.street, identity.streetNumber, identity.complement]
    .filter(Boolean)
    .join(", ");
  const locality = [identity.neighborhood, identity.city, identity.state]
    .filter(Boolean)
    .join(" · ");

  return [line, locality].filter(Boolean).join(" — ");
}
