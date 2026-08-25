import type { TherapistProfileGuideItem } from "./therapist-profile-editor.types";

/**
 * The public Match catalog is the source for these ten profile guide themes.
 * The profile editor keeps the existing guideItems contract for compatibility;
 * the icon key is rendered by the shared therapy icon vocabulary.
 */
export const therapistProfileGuideThemes = [
  {
    description:
      "Sentimentos, ansiedade, estresse e sobrecarga emocional.",
    icon: "heart",
    label: "Emoções e Bem-Estar",
    slug: "emocoes-bem-estar",
  },
  {
    description:
      "Identidade, padrões, autoaceitação e desenvolvimento pessoal.",
    icon: "mind",
    label: "Autoconhecimento e Transformação",
    slug: "autoconhecimento-transformacao",
  },
  {
    description: "Vínculos familiares, amorosos e sociais.",
    icon: "connection",
    label: "Relacionamentos",
    slug: "relacionamentos",
  },
  {
    description: "Confiança, autoimagem, insegurança e amor próprio.",
    icon: "star",
    label: "Autoestima e Poder Pessoal",
    slug: "autoestima-poder-pessoal",
  },
  {
    description: "Clareza de vida, escolhas, vocação e recomeços.",
    icon: "compass",
    label: "Propósito e Direção",
    slug: "proposito-direcao",
  },
  {
    description: "Conexão espiritual, intuição e alinhamento interior.",
    icon: "sparkles",
    label: "Espiritualidade e Conexão Interior",
    slug: "espiritualidade",
  },
  {
    description: "Percepções de energia, cansaço e equilíbrio energético.",
    icon: "energy",
    label: "Energia e Equilíbrio Energético",
    slug: "energia-equilibrio-energetico",
  },
  {
    description: "Encerramento de ciclos, passado e abertura para novos caminhos.",
    icon: "renewal",
    label: "Libertação e Renovação",
    slug: "libertacao-renovacao",
  },
  {
    description: "Relaxamento, sono, tensões e reconexão corporal.",
    icon: "leaf",
    label: "Corpo, Relaxamento e Qualidade de Vida",
    slug: "corpo-relaxamento-qualidade-vida",
  },
  {
    description: "Trabalho, carreira, prosperidade e relação com dinheiro.",
    icon: "growth",
    label: "Vida Profissional e Prosperidade",
    slug: "vida-profissional-prosperidade",
  },
] as const;

export type TherapistProfileGuideTheme =
  (typeof therapistProfileGuideThemes)[number];

export function findTherapistProfileGuideTheme(label: string) {
  const normalizedLabel = normalizeGuideThemeLabel(label);
  return therapistProfileGuideThemes.find(
    (theme) => normalizeGuideThemeLabel(theme.label) === normalizedLabel,
  );
}

export function selectedTherapistProfileGuideThemes(
  items: TherapistProfileGuideItem[],
) {
  return items
    .map((item) => findTherapistProfileGuideTheme(item.label))
    .filter((theme): theme is TherapistProfileGuideTheme => Boolean(theme))
    .filter(
      (theme, index, themes) =>
        themes.findIndex((candidate) => candidate.slug === theme.slug) === index,
    );
}

export function guideItemsFromThemes(
  themes: TherapistProfileGuideTheme[],
): TherapistProfileGuideItem[] {
  return themes.map((theme) => ({
    icon: theme.icon,
    label: theme.label,
  }));
}

export function isTherapistProfileGuideThemeItem(
  item: TherapistProfileGuideItem,
) {
  return Boolean(findTherapistProfileGuideTheme(item.label));
}

export function normalizeGuideThemeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
