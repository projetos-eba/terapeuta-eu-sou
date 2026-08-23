import type { CSSProperties } from "react";

import { TherapistPlan, isTherapistPlanAtLeast } from "@/domain/tes";

import type { PublicProfileThemeId } from "./types";

export type ProfileThemeTier = "free" | "premium" | "premium_plus";

export type ProfilePhotoShape = "circle" | "arch" | "oval" | "square";

type ThemeStyle = CSSProperties & {
  "--profile-accent": string;
  "--profile-hero-background": string;
  "--profile-shape": string;
};

export type PublicProfileThemeDefinition = {
  backgroundAsset?: string;
  description: string;
  heroBackgroundSrc?: string;
  heroIllustrationClassName?: string;
  heroIllustrationSrc?: string;
  id: PublicProfileThemeId;
  label: string;
  palette: string[];
  photoShape: ProfilePhotoShape;
  style?: ThemeStyle;
  tier: ProfileThemeTier;
};

const legacyThemeStyle: ThemeStyle = {
  "--profile-accent": "var(--tes-color-brand-primary)",
  "--profile-hero-background":
    "linear-gradient(120deg,var(--tes-color-surface-default) 0%,var(--tes-color-surface-mist) 100%)",
  "--profile-shape": "var(--tes-color-brand-lavender-soft)",
};

export const publicProfileThemes: PublicProfileThemeDefinition[] = [
  {
    description: "Lavanda e ciano em uma composição leve e acolhedora.",
    heroBackgroundSrc: "/therapists/profile-themes/serene/hero-background.png",
    heroIllustrationClassName: "bottom-[-18%] right-[-1%] w-[min(33vw,430px)]",
    heroIllustrationSrc:
      "/therapists/profile-themes/serene/hero-illustration.png",
    id: "serene",
    label: "Sereno",
    palette: ["bg-brand-lavenderSoft", "bg-brand-cyan", "bg-white"],
    photoShape: "oval",
    style: {
      "--profile-accent": "var(--tes-color-brand-cyan)",
      "--profile-hero-background":
        "linear-gradient(105deg,var(--tes-color-surface-default) 0%,var(--tes-color-brand-lavender-soft) 64%,var(--tes-color-brand-cyan-soft) 100%)",
      "--profile-shape": "var(--tes-color-brand-lavender)",
    },
    tier: "free",
  },
  {
    description: "Mint e superfícies claras com presença orgânica.",
    heroBackgroundSrc: "/therapists/profile-themes/natural/hero-background.png",
    heroIllustrationClassName: "bottom-[-18%] right-[-1%] w-[min(33vw,430px)]",
    heroIllustrationSrc:
      "/therapists/profile-themes/natural/hero-illustration.png",
    id: "natural",
    label: "Natural",
    palette: ["bg-brand-mint", "bg-status-successBg", "bg-white"],
    photoShape: "oval",
    style: {
      "--profile-accent": "var(--tes-color-status-success)",
      "--profile-hero-background":
        "linear-gradient(120deg,var(--tes-color-surface-default) 0%,var(--tes-color-status-success-bg) 72%,var(--tes-color-brand-mint) 100%)",
      "--profile-shape": "var(--tes-color-brand-mint)",
    },
    tier: "free",
  },
  {
    description: "Neutros quentes suaves e curvas delicadas.",
    heroBackgroundSrc: "/therapists/profile-themes/warm/hero-background.png",
    heroIllustrationClassName: "bottom-[-19%] right-[-2%] w-[min(36vw,470px)]",
    heroIllustrationSrc:
      "/therapists/profile-themes/warm/hero-illustration.png",
    id: "warm",
    label: "Acolhedor",
    palette: ["bg-status-warningBg", "bg-brand-lavender", "bg-white"],
    photoShape: "oval",
    style: {
      "--profile-accent": "var(--tes-color-status-warning)",
      "--profile-hero-background":
        "linear-gradient(115deg,var(--tes-color-surface-default) 0%,var(--tes-color-status-warning-bg) 76%,var(--tes-color-brand-lavender-soft) 100%)",
      "--profile-shape": "var(--tes-color-status-warning-bg)",
    },
    tier: "free",
  },
  {
    description: "Branco, mist e roxo em uma composição editorial.",
    id: "essential",
    label: "Essencial",
    palette: ["bg-white", "bg-surface-mist", "bg-brand-primary"],
    photoShape: "oval",
    style: {
      "--profile-accent": "var(--tes-color-brand-primary)",
      "--profile-hero-background":
        "linear-gradient(90deg,var(--tes-color-surface-default) 0%,var(--tes-color-surface-mist) 100%)",
      "--profile-shape": "var(--tes-color-brand-lavender-soft)",
    },
    tier: "free",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/sereno-horizonte.png",
    description: "Horizonte suave com detalhes orgânicos e dourados.",
    id: "sereno_horizonte",
    label: "Sereno — Horizonte",
    palette: ["bg-brand-lavenderSoft", "bg-status-warningBg", "bg-white"],
    photoShape: "arch",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/frequencia.png",
    description: "Linhas e ritmos para uma presença contemporânea.",
    id: "frequencia",
    label: "Frequencia",
    palette: ["bg-brand-primary", "bg-brand-cyanSoft", "bg-white"],
    photoShape: "oval",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/energia.png",
    description: "Cores vibrantes em uma composição expressiva.",
    id: "energia",
    label: "Energia",
    palette: ["bg-status-warningBg", "bg-brand-cyan", "bg-white"],
    photoShape: "oval",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/geometria.png",
    description: "Estrutura gráfica com contraste e precisão.",
    id: "geometria",
    label: "Geometria",
    palette: ["bg-brand-deep", "bg-brand-lavender", "bg-white"],
    photoShape: "square",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/cristalino.png",
    description: "Transparências leves e luminosidade delicada.",
    id: "cristalino",
    label: "Cristalino",
    palette: ["bg-brand-cyanSoft", "bg-brand-lavenderSoft", "bg-white"],
    photoShape: "oval",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/oraculo.png",
    description: "Símbolos sutis em uma atmosfera contemplativa.",
    id: "oraculo",
    label: "Oráculo",
    palette: ["bg-brand-deep", "bg-status-warningBg", "bg-white"],
    photoShape: "arch",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/celestial.png",
    description: "Uma composição ampla, calma e luminosa.",
    id: "celestial",
    label: "Celestial",
    palette: ["bg-brand-primary", "bg-brand-cyanSoft", "bg-white"],
    photoShape: "circle",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/lunar.png",
    description: "Contraste noturno com detalhes de luz.",
    id: "lunar",
    label: "Lunar",
    palette: ["bg-brand-deep", "bg-brand-lavender", "bg-white"],
    photoShape: "oval",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/botanico.png",
    description: "Formas naturais para uma apresentação orgânica.",
    id: "botanico",
    label: "Botânico",
    palette: ["bg-brand-mint", "bg-status-successBg", "bg-white"],
    photoShape: "arch",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/ancestral.png",
    description: "Texturas marcantes e uma composição estruturada.",
    id: "ancestral",
    label: "Ancestral",
    palette: ["bg-status-warningBg", "bg-brand-deep", "bg-white"],
    photoShape: "square",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/vinculos.png",
    description: "Elementos conectados para destacar sua identidade.",
    id: "vinculos",
    label: "Vinculos",
    palette: ["bg-brand-cyan", "bg-brand-lavenderSoft", "bg-white"],
    photoShape: "circle",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/sagrado.png",
    description: "Camadas delicadas em uma atmosfera acolhedora.",
    id: "sagrado",
    label: "Sagrado",
    palette: ["bg-brand-lavender", "bg-status-warningBg", "bg-white"],
    photoShape: "arch",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/aurora.png",
    description: "Luz e cor em movimento para uma presença viva.",
    id: "aurora",
    label: "Aurora",
    palette: ["bg-brand-cyan", "bg-brand-lavender", "bg-white"],
    photoShape: "oval",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/profundo.png",
    description: "Profundidade cromática com leitura serena.",
    id: "profundo",
    label: "Profundo",
    palette: ["bg-brand-deep", "bg-brand-primary", "bg-white"],
    photoShape: "arch",
    style: legacyThemeStyle,
    tier: "premium",
  },
  {
    backgroundAsset: "/therapists/profile-themes/library/essencial-editorial.png",
    description: "Composição limpa com acabamento editorial.",
    id: "essencial_editorial",
    label: "Essencial — Editorial",
    palette: ["bg-white", "bg-surface-mist", "bg-brand-primary"],
    photoShape: "circle",
    style: legacyThemeStyle,
    tier: "premium",
  },
];

export const publicProfileThemeById = Object.fromEntries(
  publicProfileThemes.map((theme) => [theme.id, theme]),
) as Record<PublicProfileThemeId, PublicProfileThemeDefinition>;

export function isPublicProfileThemeId(
  value: unknown,
): value is PublicProfileThemeId {
  return typeof value === "string" && value in publicProfileThemeById;
}

export function canUsePublicProfileTheme(
  plan: TherapistPlan,
  theme: PublicProfileThemeDefinition,
) {
  const minimumPlan =
    theme.tier === "premium_plus"
      ? TherapistPlan.PremiumPlus
      : theme.tier === "premium"
        ? TherapistPlan.Premium
        : TherapistPlan.Free;

  return isTherapistPlanAtLeast(plan, minimumPlan);
}

export function profilePhotoShapeClassName(shape: ProfilePhotoShape) {
  switch (shape) {
    case "arch":
      return "rounded-t-[999px] rounded-b-[var(--tes-radius-card)]";
    case "circle":
      return "rounded-full";
    case "square":
      return "rounded-card";
    case "oval":
    default:
      return "rounded-[42%]";
  }
}
