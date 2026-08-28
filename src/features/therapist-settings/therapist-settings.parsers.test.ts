import { describe, expect, it } from "vitest";

import {
  formatDocumentNumber,
  formatPostalCode,
  parseTherapistSettingsUpdatePayload,
  TherapistSettingsContractError,
} from "./therapist-settings.parsers";

describe("therapist settings parsers", () => {
  it("normalizes editable account settings", () => {
    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "  Ana Oliveira  ",
        phone: "  +55 11 99999-9999  ",
      }),
    ).toEqual({
      displayName: "Ana Oliveira",
      phone: "+55 11 99999-9999",
    });
  });

  it("accepts an empty phone", () => {
    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: " ",
      }),
    ).toMatchObject({ phone: "" });
  });

  it("rejects invalid display names and phone numbers", () => {
    expect(() =>
      parseTherapistSettingsUpdatePayload({
        displayName: "A",
        phone: "+55 11 99999-9999",
      }),
    ).toThrow(TherapistSettingsContractError);

    expect(() =>
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: "telefone<script>",
      }),
    ).toThrow(TherapistSettingsContractError);
  });

  it("normalizes private identity fields and accepts the supported document types", () => {
    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: "",
        identity: {
          city: " São Paulo ",
          complement: "Apto 42",
          documentNumber: "529.982.247-25",
          documentType: "cpf",
          neighborhood: "Pinheiros",
          postalCode: "05409-000",
          state: "sp",
          street: "Rua dos Pinheiros",
          streetNumber: "100",
        },
      }),
    ).toMatchObject({
      identity: {
        city: "São Paulo",
        documentNumber: "52998224725",
        documentType: "cpf",
        postalCode: "05409000",
        state: "SP",
      },
    });

    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: "",
        identity: {
          city: "São Paulo",
          complement: "",
          documentNumber: "123456789",
          documentType: "rg",
          neighborhood: "Centro",
          postalCode: "01001-000",
          state: "SP",
          street: "Rua Direita",
          streetNumber: "10",
        },
      }),
    ).toMatchObject({ identity: { documentType: "rg" } });

    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: "",
        identity: {
          city: "São Paulo",
          complement: "",
          documentNumber: "AB123456",
          documentType: "passport",
          neighborhood: "Centro",
          postalCode: "01001-000",
          state: "SP",
          street: "Rua Direita",
          streetNumber: "10",
        },
      }),
    ).toMatchObject({ identity: { documentType: "passport" } });
  });

  it("formats document and postal code masks without changing stored values", () => {
    expect(formatDocumentNumber("52998224725", "cpf")).toBe("529.982.247-25");
    expect(formatDocumentNumber("123456789", "rg")).toBe("12.345.678-9");
    expect(formatDocumentNumber("ab123456", "passport")).toBe("AB123456");
    expect(formatPostalCode("05409000")).toBe("05409-000");
  });

  it("rejects malformed, repeated and checksum-invalid CPF values", () => {
    expect(() =>
      parseIdentityWithDocumentNumber("1234567890"),
    ).toThrow("cpf_invalid");
    expect(() => parseIdentityWithDocumentNumber("11111111111")).toThrow(
      "cpf_invalid",
    );
    expect(() => parseIdentityWithDocumentNumber("52998224726")).toThrow(
      "cpf_invalid",
    );
  });

  it("rejects invalid non-CPF document values", () => {
    expect(() =>
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: "",
        identity: {
          city: "São Paulo",
          complement: "",
          documentNumber: "ABC",
          documentType: "passport",
          neighborhood: "Centro",
          postalCode: "01001-000",
          state: "SP",
          street: "Rua Direita",
          streetNumber: "10",
        },
      }),
    ).toThrow(TherapistSettingsContractError);
  });
});

function parseIdentityWithDocumentNumber(documentNumber: string) {
  return parseTherapistSettingsUpdatePayload({
    displayName: "Ana Oliveira",
    phone: "",
    identity: {
      city: "São Paulo",
      complement: "",
      documentNumber,
      documentType: "cpf",
      neighborhood: "Centro",
      postalCode: "01001-000",
      state: "SP",
      street: "Rua Direita",
      streetNumber: "10",
    },
  });
}
