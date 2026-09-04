export type PhoneCountry = {
  iso: string;
  name: string;
  code: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  ["BR", "Brasil", "55"],
  ["AF", "Afeganistão", "93"],
  ["ZA", "África do Sul", "27"],
  ["AL", "Albânia", "355"],
  ["DE", "Alemanha", "49"],
  ["AD", "Andorra", "376"],
  ["AO", "Angola", "244"],
  ["AR", "Argentina", "54"],
  ["AU", "Austrália", "61"],
  ["AT", "Áustria", "43"],
  ["BE", "Bélgica", "32"],
  ["BO", "Bolívia", "591"],
  ["CA", "Canadá", "1"],
  ["CL", "Chile", "56"],
  ["CN", "China", "86"],
  ["CO", "Colômbia", "57"],
  ["CR", "Costa Rica", "506"],
  ["DK", "Dinamarca", "45"],
  ["EC", "Equador", "593"],
  ["EG", "Egito", "20"],
  ["ES", "Espanha", "34"],
  ["US", "Estados Unidos", "1"],
  ["FR", "França", "33"],
  ["GR", "Grécia", "30"],
  ["IN", "Índia", "91"],
  ["IE", "Irlanda", "353"],
  ["IL", "Israel", "972"],
  ["IT", "Itália", "39"],
  ["JP", "Japão", "81"],
  ["MX", "México", "52"],
  ["NO", "Noruega", "47"],
  ["NZ", "Nova Zelândia", "64"],
  ["NL", "Países Baixos", "31"],
  ["PY", "Paraguai", "595"],
  ["PE", "Peru", "51"],
  ["PT", "Portugal", "351"],
  ["GB", "Reino Unido", "44"],
  ["CH", "Suíça", "41"],
  ["UY", "Uruguai", "598"],
  ["VE", "Venezuela", "58"],
].map(([iso, name, code]) => ({ iso, name, code }));

export function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatPhoneNumber(value: string, countryCode = "55") {
  const digits = normalizePhoneDigits(value);
  if (countryCode === "55") {
    const limited = digits.slice(0, 11);
    if (limited.length <= 2) return limited;
    if (limited.length <= 6)
      return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    if (limited.length <= 10)
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  }
  const limited = digits.slice(0, 15);
  return limited.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function validatePhoneNumber(
  countryCode: string,
  value: string,
  required = false,
) {
  const digits = normalizePhoneDigits(value);
  if (!digits) return required ? "Informe seu telefone." : null;
  if (!PHONE_COUNTRIES.some((country) => country.code === countryCode))
    return "Selecione um código de país válido.";
  if (digits.length < 4 || digits.length > 15 || /^(\d)\1+$/.test(digits))
    return "Informe um telefone válido.";
  if (
    countryCode === "55" &&
    (digits.length < 10 || digits.length > 11 || digits.slice(0, 2) === "00")
  )
    return "Informe um telefone brasileiro válido com DDD.";
  return null;
}

export function toE164(countryCode: string, value: string) {
  const digits = normalizePhoneDigits(value);
  return digits ? `+${countryCode}${digits}` : null;
}
